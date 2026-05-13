export const ASSET_PROFILES = {
  BTC: { base: 61200, volatility: 0.012, whaleBase: 880, addressBase: 980000, symbol: "BTCUSDT" },
  ETH: { base: 3060, volatility: 0.018, whaleBase: 460, addressBase: 620000, symbol: "ETHUSDT" },
  SOL: { base: 142, volatility: 0.026, whaleBase: 190, addressBase: 410000, symbol: "SOLUSDT" }
};

export const KLINE_CONFIG = [
  { key: "15m", interval: "15m", limit: 160, hours: 0.25 },
  { key: "1h", interval: "1h", limit: 120, hours: 1 },
  { key: "4h", interval: "4h", limit: 120, hours: 4 },
  { key: "1d", interval: "1d", limit: 160, hours: 24 },
  { key: "1w", interval: "1w", limit: 120, hours: 24 * 7 },
  { key: "1M", interval: "1M", limit: 96, hours: 24 * 30 }
];

export const DEFAULT_SETTINGS = {
  language: "zh",
  model: "balanced",
  marketProvider: "binance",
  onchainProvider: "mock",
  derivativesProvider: "binance",
  apiKey: "",
  marketUrl: "",
  onchainUrl: "",
  derivativesUrl: "",
  glassnodeUrl: "",
  llmProvider: "deepseek",
  llmModel: "deepseek-chat"
};

export const MODEL_WEIGHTS = {
  balanced: { trend: 0.36, onchain: 0.38, derivatives: 0.26, labelKey: "balancedModel" },
  trend: { trend: 0.55, onchain: 0.25, derivatives: 0.2, labelKey: "trendModel" },
  onchain: { trend: 0.22, onchain: 0.58, derivatives: 0.2, labelKey: "onchainModel" },
  derivatives: { trend: 0.22, onchain: 0.24, derivatives: 0.54, labelKey: "derivativesModel" }
};

export const MARKET_KEYWORDS = [
  "btc", "eth", "sol", "行情", "价格", "趋势", "做多", "做空", "分析",
  "k线", "链上", "资金费率", "long", "short", "signal", "trend",
  "要不要", "会不会涨", "会不会跌"
];

export const SETTINGS_KEY = "ai-market-sentinel-settings";
