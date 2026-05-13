import { MODEL_WEIGHTS } from "./constants.js";

export function sma(values, period) {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const slice = values.slice(index - period + 1, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

export function ema(values, period) {
  const alpha = 2 / (period + 1);
  let previous = values[0] ?? 0;
  return values.map((value, index) => {
    if (index === 0) return value;
    previous = value * alpha + previous * (1 - alpha);
    return previous;
  });
}

export function movingStd(values, period) {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const slice = values.slice(index - period + 1, index + 1);
    const mean = slice.reduce((sum, value) => sum + value, 0) / period;
    const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
    return Math.sqrt(variance);
  });
}

export function bollinger(values, period = 20, width = 2) {
  const mid = sma(values, period);
  const deviation = movingStd(values, period);
  return mid.map((value, index) => ({
    mid: value,
    upper: value == null || deviation[index] == null ? null : value + deviation[index] * width,
    lower: value == null || deviation[index] == null ? null : value - deviation[index] * width
  }));
}

export function rsi(values, period = 14) {
  let avgGain = 0;
  let avgLoss = 0;
  return values.map((value, index) => {
    if (index === 0) return null;
    const change = value - values[index - 1];
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    if (index <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (index < period) return null;
      avgGain /= period;
      avgLoss /= period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  });
}

export function macd(values, fast = 12, slow = 26, signal = 9) {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const dif = values.map((_, index) => fastEma[index] - slowEma[index]);
  const dea = ema(dif, signal);
  const hist = dif.map((value, index) => (value - dea[index]) * 2);
  return { dif, dea, hist };
}

export function fmtNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Number.isFinite(value) ? value : 0);
}

export function pct(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(2)}%`;
}

export function analyzeCandles(candles, t) {
  const closes = candles.map((candle) => candle.close);
  const last = candles.at(-1);
  const prev = candles.at(-2);
  const start = candles.at(-22) || candles[0];
  const change = ((last.close - start.close) / start.close) * 100;
  const ma20 = sma(closes, 20).at(-1);
  const ma50 = sma(closes, 50).at(-1) || ma20;
  const bodies = candles.slice(-12).map((c) => Math.abs(c.close - c.open));
  const avgBody = bodies.reduce((sum, item) => sum + item, 0) / bodies.length;
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const engulfingUp = last.close > last.open && prev.close < prev.open && last.close > prev.open && last.open < prev.close;
  const engulfingDown = last.close < last.open && prev.close > prev.open && last.open > prev.close && last.close < prev.open;

  let trend = t("sideways");
  if (change > 2.2 && last.close > ma20 && ma20 >= ma50) trend = t("up");
  if (change < -2.2 && last.close < ma20 && ma20 <= ma50) trend = t("down");

  let structure = t("range");
  if (trend === t("up")) structure = upperWick > avgBody * 1.7 ? t("upResistance") : t("higherHighs");
  if (trend === t("down")) structure = lowerWick > avgBody * 1.7 ? t("downSupport") : t("lowerHighs");

  let reversal = t("noSignal");
  if (engulfingUp || lowerWick > avgBody * 2.2) reversal = t("bullishReversal");
  if (engulfingDown || upperWick > avgBody * 2.2) reversal = t("bearishReversal");
  if (Math.abs(change) < 1.1 && avgBody / last.close < 0.006) reversal = t("compression");

  const confidence = Math.min(94, Math.max(48, Math.round(55 + Math.abs(change) * 7 + Math.abs(last.close - ma20) / last.close * 900)));
  return { trend, structure, reversal, confidence, change, ma20 };
}

export function scoreOnchain(onchain) {
  let score = 50;
  score += onchain.exchangeNetflow < 0 ? 14 : -14;
  score += onchain.activeAddresses > 900000 ? 8 : onchain.activeAddresses < 450000 ? -6 : 3;
  score += onchain.whaleTransactions > 900 ? -8 : 4;
  score += onchain.supplyDistribution > 0 ? 7 : -7;
  score += onchain.mvrv > 2.35 ? -13 : onchain.mvrv < 1.05 ? 10 : 2;
  score += onchain.sopr > 1.05 ? -4 : onchain.sopr < 0.98 ? 7 : 1;
  return Math.max(0, Math.min(100, score));
}

export function scoreDerivatives(derivatives) {
  let score = 50;
  score += Math.abs(derivatives.fundingRate) > 0.045 ? -12 : 5;
  score += derivatives.fundingRate < -0.02 ? 7 : 0;
  score += derivatives.longShortRatio > 1.35 ? -9 : derivatives.longShortRatio < 0.86 ? 8 : 2;
  score += derivatives.openInterestChange > 7 ? -8 : derivatives.openInterestChange < -5 ? 6 : 1;
  score += derivatives.liquidations > 190 ? 5 : -1;
  return Math.max(0, Math.min(100, score));
}

export function buildAiDecision(market, state, t) {
  const trendResults = Object.fromEntries(Object.entries(market.kline).map(([tf, candles]) => [tf, analyzeCandles(candles, t)]));
  const onchainScore = scoreOnchain(market.onchain);
  const derivativeScore = scoreDerivatives(market.derivatives);
  const trendScore = Object.values(trendResults).reduce((score, result) => {
    if (result.trend === t("up")) return score + 13;
    if (result.trend === t("down")) return score - 13;
    return score;
  }, 50);
  const weights = MODEL_WEIGHTS[state.settings.model] || MODEL_WEIGHTS.balanced;
  const riskAdjust = { conservative: -5, balanced: 0, aggressive: 4 }[state.risk];
  const score = Math.max(0, Math.min(100, Math.round(trendScore * weights.trend + onchainScore * weights.onchain + derivativeScore * weights.derivatives + riskAdjust)));

  let regime = t("neutral");
  if (score >= 68) regime = t("bullish");
  if (score >= 80) regime = t("strongBullish");
  if (score <= 42) regime = t("bearish");
  if (score <= 28) regime = t("highRiskBearish");

  const heated = market.derivatives.fundingRate > 0.035 && market.derivatives.longShortRatio > 1.28 && market.onchain.mvrv > 2.15;
  const panic = market.derivatives.fundingRate < -0.025 && market.onchain.sopr < 0.98 && market.derivatives.liquidations > 150;
  const bullTrap = trendResults["1h"].trend === t("up") && market.onchain.exchangeNetflow > 1800 && market.derivatives.longShortRatio > 1.3;
  const bearTrap = trendResults["1h"].trend === t("down") && market.onchain.exchangeNetflow < -2200 && market.derivatives.fundingRate < -0.02;
  const sentiment = heated ? t("hot") : panic ? t("panic") : score > 58 ? t("optimistic") : score < 44 ? t("cautious") : t("neutral");
  const trap = bullTrap ? t("bullTrap") : bearTrap ? t("bearTrap") : t("noTrap");

  return { trendResults, trendScore, onchainScore, derivativeScore, score, regime, sentiment, trap, heated, panic, bullTrap, bearTrap, model: t(weights.labelKey) };
}
