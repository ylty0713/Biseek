import { ASSET_PROFILES, KLINE_CONFIG } from "./constants.js";
import { fetchJson } from "./api.js";

export class MockDataProvider {
  constructor() {
    this.seed = Date.now() % 100000;
  }

  load(asset) {
    const profile = ASSET_PROFILES[asset];
    return {
      kline: Object.fromEntries(KLINE_CONFIG.map((item) => [item.key, this.generateCandles(profile, item.limit, item.hours)])),
      onchain: this.generateOnchain(profile),
      derivatives: this.generateDerivatives(),
      generatedAt: new Date(),
      sources: { market: "Mock", onchain: "Mock", derivatives: "Mock" }
    };
  }

  random() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  normal(scale = 1) {
    return (this.random() + this.random() + this.random() - 1.5) * scale;
  }

  generateCandles(profile, count, hourStep) {
    const candles = [];
    let price = profile.base * (0.98 + this.random() * 0.04);
    const drift = this.normal(profile.volatility * 0.32);
    const now = Date.now();

    for (let i = 0; i < count; i += 1) {
      const cycle = Math.sin((i / count) * Math.PI * 2.4) * profile.volatility * 0.7;
      const shock = this.normal(profile.volatility);
      const open = price;
      const close = Math.max(0.01, open * (1 + drift + cycle + shock));
      const wick = Math.abs(this.normal(profile.volatility * 1.5));
      candles.push({
        time: now - (count - i) * hourStep * 3600000,
        open,
        high: Math.max(open, close) * (1 + wick),
        low: Math.min(open, close) * (1 - wick * 0.9),
        close,
        volume: Math.round((900 + this.random() * 1700) * (1 + Math.abs(shock) * 18))
      });
      price = close;
    }
    return candles;
  }

  generateOnchain(profile) {
    return {
      exchangeNetflow: Math.round(this.normal(5200)),
      activeAddresses: Math.round(profile.addressBase * (0.92 + this.random() * 0.2)),
      whaleTransactions: Math.round(profile.whaleBase * (0.72 + this.random() * 0.82)),
      supplyDistribution: Number(this.normal(1.6).toFixed(2)),
      mvrv: Number((0.86 + this.random() * 1.95).toFixed(2)),
      sopr: Number((0.94 + this.random() * 0.16).toFixed(3))
    };
  }

  generateDerivatives() {
    return {
      fundingRate: Number(this.normal(0.036).toFixed(4)),
      longShortRatio: Number((0.76 + this.random() * 0.82).toFixed(2)),
      liquidations: Math.round(18 + this.random() * 280),
      liquidationBias: this.random() > 0.48 ? "long" : "short",
      openInterestChange: Number(this.normal(8.5).toFixed(2))
    };
  }
}

export class RealDataProvider {
  constructor(settings) {
    this.settings = settings;
    this.mock = new MockDataProvider();
  }

  async load(asset) {
    const [kline, onchain, derivatives] = await Promise.all([
      this.loadKlines(asset),
      this.loadOnchain(asset),
      this.loadDerivatives(asset)
    ]);
    return {
      kline,
      onchain,
      derivatives,
      generatedAt: new Date(),
      sources: {
        market: providerName(this.settings.marketProvider),
        onchain: providerName(this.settings.onchainProvider),
        derivatives: providerName(this.settings.derivativesProvider)
      }
    };
  }

  async loadKlines(asset) {
    if (this.settings.marketProvider === "custom") {
      const symbol = ASSET_PROFILES[asset].symbol;
      const candles = await Promise.all(KLINE_CONFIG.map((item) =>
        fetchCustomKlines(this.settings.marketUrl, asset, symbol, item.key, item.limit, this.settings.apiKey)
      ));
      return Object.fromEntries(KLINE_CONFIG.map((item, index) => [item.key, candles[index]]));
    }

    if (this.settings.marketProvider === "mock") {
      return this.mock.load(asset).kline;
    }

    if (this.settings.marketProvider !== "binance") {
      throw new Error(`Unsupported market provider: ${this.settings.marketProvider}`);
    }

    const symbol = ASSET_PROFILES[asset].symbol;
    const candles = await Promise.all(KLINE_CONFIG.map((item) => fetchBinanceKlines(symbol, item.interval, item.limit)));
    return Object.fromEntries(KLINE_CONFIG.map((item, index) => [item.key, candles[index]]));
  }

  async loadOnchain(asset) {
    if (this.settings.onchainProvider === "custom") {
      return normalizeOnchain(await fetchJson(expandTemplate(this.settings.onchainUrl, asset, this.settings.apiKey)));
    }
    if (this.settings.onchainProvider === "glassnode") {
      return normalizeOnchain(await fetchJson(expandTemplate(this.settings.glassnodeUrl, asset, this.settings.apiKey)));
    }
    return this.mock.load(asset).onchain;
  }

  async loadDerivatives(asset) {
    if (this.settings.derivativesProvider === "custom") {
      return normalizeDerivatives(await fetchJson(expandTemplate(this.settings.derivativesUrl, asset, this.settings.apiKey)));
    }
    if (this.settings.derivativesProvider !== "binance") {
      return this.mock.load(asset).derivatives;
    }

    const symbol = ASSET_PROFILES[asset].symbol;
    const [premium, ratioRows, openInterest] = await Promise.all([
      fetchJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
      fetchJson(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`),
      fetchJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`)
    ]);
    const ratio = Array.isArray(ratioRows) && ratioRows[0] ? Number(ratioRows[0].longShortRatio) : 1;
    const fundingRate = Number(premium.lastFundingRate || 0) * 100;
    const oiMagnitude = Math.min(12, Math.log10(Math.max(1, Number(openInterest.openInterest || 1))) - 3);

    return {
      fundingRate: Number(fundingRate.toFixed(4)),
      longShortRatio: Number(ratio.toFixed(2)),
      liquidations: 0,
      liquidationBias: ratio > 1 ? "long" : "short",
      openInterestChange: Number(oiMagnitude.toFixed(2))
    };
  }
}

export function providerName(value) {
  return { binance: "Binance", glassnode: "Glassnode", custom: "Custom API", mock: "Mock" }[value] || value;
}

function expandTemplate(template, asset, apiKey, extra = {}) {
  return template
    .replaceAll("{asset}", encodeURIComponent(asset))
    .replaceAll("{symbol}", encodeURIComponent(extra.symbol || ASSET_PROFILES[asset].symbol))
    .replaceAll("{timeframe}", encodeURIComponent(extra.timeframe || "1h"))
    .replaceAll("{limit}", encodeURIComponent(String(extra.limit || 100)))
    .replaceAll("{apiKey}", encodeURIComponent(apiKey || ""));
}

async function fetchBinanceKlines(symbol, interval, limit) {
  const rows = await fetchJson(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  return rows.map((row) => ({
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5])
  }));
}

async function fetchCustomKlines(template, asset, symbol, timeframe, limit, apiKey) {
  const url = expandTemplate(template, asset, apiKey, { symbol, timeframe, limit });
  return normalizeCandles(await fetchJson(url));
}

function normalizeCandles(data) {
  const rows = Array.isArray(data) ? data : data.candles || data.data || [];
  return rows.map((row) => Array.isArray(row)
    ? { time: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5] || 0) }
    : { time: Number(row.time ?? row.timestamp ?? row.t), open: Number(row.open ?? row.o), high: Number(row.high ?? row.h), low: Number(row.low ?? row.l), close: Number(row.close ?? row.c), volume: Number(row.volume ?? row.v ?? 0) }
  ).filter((row) => Number.isFinite(row.close));
}

function normalizeOnchain(data) {
  const src = Array.isArray(data) ? data.at(-1) : data;
  const value = src.v && typeof src.v === "object" ? src.v : src;
  return {
    exchangeNetflow: Number(value.exchangeNetflow ?? value.exchange_netflow ?? value.netflow ?? value.v ?? 0),
    activeAddresses: Number(value.activeAddresses ?? value.active_addresses ?? 0),
    whaleTransactions: Number(value.whaleTransactions ?? value.whale_transactions ?? 0),
    supplyDistribution: Number(value.supplyDistribution ?? value.supply_distribution ?? 0),
    mvrv: Number(value.mvrv ?? 1.2),
    sopr: Number(value.sopr ?? 1)
  };
}

function normalizeDerivatives(data) {
  const src = Array.isArray(data) ? data.at(-1) : data;
  return {
    fundingRate: Number(src.fundingRate ?? src.funding_rate ?? 0),
    longShortRatio: Number(src.longShortRatio ?? src.long_short_ratio ?? 1),
    liquidations: Number(src.liquidations ?? 0),
    liquidationBias: src.liquidationBias ?? src.liquidation_bias ?? "long",
    openInterestChange: Number(src.openInterestChange ?? src.open_interest_change ?? 0)
  };
}
