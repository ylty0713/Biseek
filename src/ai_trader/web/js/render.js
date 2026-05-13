import { ASSET_PROFILES, MODEL_WEIGHTS } from "./constants.js";
import { els } from "./dom.js";
import { bollinger, buildAiDecision, ema, fmtNumber, macd, pct, rsi, sma } from "./analysis.js";
import { providerName } from "./providers.js";

export function render(state, t) {
  if (!state.market) return null;
  const decision = buildAiDecision(state.market, state, t);
  const currentAnalysis = decision.trendResults[state.timeframe];
  const currentCandles = state.market.kline[state.timeframe];

  renderChart(state, currentCandles, currentAnalysis);
  els.scoreValue.textContent = decision.score;
  els.scoreLabel.textContent = `${decision.regime} / ${decision.model}`;
  els.trendValue.textContent = decision.trendResults["4h"].trend;
  els.trendHint.textContent = `${decision.trendResults["15m"].structure} / ${decision.trendResults["1d"].structure}`;
  els.onchainValue.textContent = `${decision.onchainScore}/100`;
  els.onchainHint.textContent = state.market.onchain.exchangeNetflow < 0 ? t("exchangeOutflow") : t("exchangeInflow");
  els.chartSubtitle.textContent = buildChartSubtitle(state, currentCandles, currentAnalysis);
  els.updatedAt.textContent = `${t("updated")}: ${state.market.generatedAt.toLocaleString("zh-CN")}`;
  els.regimeBadge.textContent = decision.regime;

  updateMarketSnapshot(state, decision, t);
  renderTrendTable(decision, t);
  renderIndicators(state, decision, t);
  renderSources(state, t);
  return decision;
}

export function renderMarketError(message, t) {
  const canvas = els.canvas;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#0c0f12";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.strokeStyle = "#303741";
  ctx.strokeRect(10, 10, rect.width - 20, rect.height - 20);
  ctx.fillStyle = "#ff6363";
  ctx.font = "700 16px Segoe UI";
  ctx.fillText("真实行情数据获取失败", 26, 42);
  ctx.fillStyle = "#9da7a9";
  ctx.font = "13px Segoe UI";
  wrapCanvasText(ctx, message, 26, 72, rect.width - 52, 20);

  els.scoreValue.textContent = "--";
  els.scoreLabel.textContent = t("waiting");
  els.trendValue.textContent = "--";
  els.trendHint.textContent = "No real market data";
  els.onchainValue.textContent = "--";
  els.onchainHint.textContent = "No real market data";
  els.chartSubtitle.textContent = "真实行情数据获取失败";
  els.updatedAt.textContent = "--";
  els.regimeBadge.textContent = "--";
  els.marketSnapshotMsg.textContent = message;
  els.trendTable.innerHTML = "";
  els.onchainList.innerHTML = "";
  els.derivativesList.innerHTML = "";
  els.trapBox.textContent = message;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function buildChartSubtitle(state, candles, analysis) {
  const view = getVisibleRange(state, candles.length);
  const visible = candles.slice(view.start, view.end);
  const high = Math.max(...visible.map((candle) => candle.high));
  const low = Math.min(...visible.map((candle) => candle.low));
  const last = visible.at(-1);
  return `${state.asset} ${state.timeframe} | 当前 ${tPrice(last.close)} | 可见高点 ${tPrice(high)} | 可见低点 ${tPrice(low)} | ${analysis.reversal}`;
}

export function renderChart(state, candles, analysis) {
  const canvas = els.canvas;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.scale(ratio, ratio);

  const width = rect.width;
  const height = rect.height;
  const pad = { top: 26, right: 86, bottom: 24, left: 10 };
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0c0f12";
  ctx.fillRect(0, 0, width, height);

  const plotW = Math.max(120, width - pad.left - pad.right);
  const usableH = Math.max(320, height - pad.top - pad.bottom);
  const mainH = Math.round(usableH * 0.56);
  const volumeH = Math.round(usableH * 0.15);
  const rsiH = Math.round(usableH * 0.13);
  const macdH = usableH - mainH - volumeH - rsiH - 18;
  const panels = {
    price: { top: pad.top, height: mainH },
    volume: { top: pad.top + mainH + 6, height: volumeH },
    rsi: { top: pad.top + mainH + volumeH + 12, height: rsiH },
    macd: { top: pad.top + mainH + volumeH + rsiH + 18, height: macdH }
  };

  const view = getVisibleRange(state, candles.length);
  const visible = candles.slice(view.start, view.end);
  if (!visible.length) return;

  const closes = candles.map((c) => c.close);
  const indicator = {
    ma5: sma(closes, 5),
    ma10: sma(closes, 10),
    ma20: sma(closes, 20),
    ma60: sma(closes, 60),
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    boll: bollinger(closes),
    rsi6: rsi(closes, 6),
    rsi12: rsi(closes, 12),
    rsi24: rsi(closes, 24),
    macd: macd(closes)
  };

  const priceValues = visible.flatMap((c) => [c.high, c.low]);
  for (const key of ["ma5", "ma10", "ma20", "ma60", "ema12", "ema26"]) {
    priceValues.push(...indicator[key].slice(view.start, view.end).filter(Number.isFinite));
  }
  indicator.boll.slice(view.start, view.end).forEach((item) => {
    if (item.upper != null) priceValues.push(item.upper);
    if (item.lower != null) priceValues.push(item.lower);
  });

  const priceHigh = Math.max(...priceValues);
  const priceLow = Math.min(...priceValues);
  const pricePad = Math.max((priceHigh - priceLow) * 0.08, priceHigh * 0.001);
  const priceMax = priceHigh + pricePad;
  const priceMin = priceLow - pricePad;
  const priceSpan = priceMax - priceMin || 1;
  const priceY = (price) => panels.price.top + (priceMax - price) / priceSpan * panels.price.height;
  const xStep = plotW / visible.length;
  const candleW = Math.max(1, Math.min(14, xStep * 0.66));
  const x = (visibleIndex) => pad.left + visibleIndex * xStep + xStep / 2;

  drawPanelGrid(ctx, pad.left, plotW, panels.price, 5);
  drawPanelGrid(ctx, pad.left, plotW, panels.volume, 2);
  drawPanelGrid(ctx, pad.left, plotW, panels.rsi, 2);
  drawPanelGrid(ctx, pad.left, plotW, panels.macd, 2);
  drawPriceAxis(ctx, width, pad.right, panels.price, priceMin, priceMax);

  const volumeMax = Math.max(...visible.map((c) => c.volume), 1);
  visible.forEach((candle, index) => {
    const up = candle.close >= candle.open;
    const color = up ? "#2ed18f" : "#ff6363";
    const cx = x(index);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, priceY(candle.high));
    ctx.lineTo(cx, priceY(candle.low));
    ctx.stroke();
    const top = priceY(Math.max(candle.open, candle.close));
    const bottom = priceY(Math.min(candle.open, candle.close));
    ctx.fillRect(cx - candleW / 2, top, candleW, Math.max(2, bottom - top));

    const vh = (candle.volume / volumeMax) * panels.volume.height;
    ctx.globalAlpha = 0.48;
    ctx.fillRect(cx - candleW / 2, panels.volume.top + panels.volume.height - vh, candleW, vh);
    ctx.globalAlpha = 1;
  });

  drawSeries(ctx, indicator.ma5, view, x, priceY, "#d9d55f", 1.4);
  drawSeries(ctx, indicator.ma10, view, x, priceY, "#42c6df", 1.4);
  drawSeries(ctx, indicator.ma20, view, x, priceY, "#f1b84b", 1.6);
  drawSeries(ctx, indicator.ma60, view, x, priceY, "#b48cff", 1.4);
  drawSeries(ctx, indicator.ema12, view, x, priceY, "#55a7ff", 1.1);
  drawSeries(ctx, indicator.ema26, view, x, priceY, "#ff7ab6", 1.1);
  drawBollinger(ctx, indicator.boll, view, x, priceY);

  drawHighLowMarkers(ctx, visible, x, priceY, tPrice);
  drawCurrentPrice(ctx, width, pad.left, pad.right, priceY, visible.at(-1).close, tPrice);
  drawRsiPanel(ctx, indicator, view, x, panels.rsi);
  drawMacdPanel(ctx, indicator.macd, view, x, panels.macd, xStep);
  drawTimeAxis(ctx, visible, x, panels.macd.top + panels.macd.height + 4);
  drawHeader(ctx, state, analysis, visible.at(-1), indicator, view.start + visible.length - 1, pad.left);
  drawHover(ctx, state, visible, view, x, priceY, panels, pad, width, indicator);
}

export function getVisibleRange(state, length) {
  const minCount = Math.min(24, length);
  const maxCount = Math.max(minCount, length);
  const visibleCount = Math.max(minCount, Math.min(maxCount, Math.round(state.chart.visibleCount || 96)));
  const offset = Math.max(0, Math.min(length - visibleCount, Math.round(state.chart.offsetFromRight || 0)));
  state.chart.visibleCount = visibleCount;
  state.chart.offsetFromRight = offset;
  const end = length - offset;
  return { start: Math.max(0, end - visibleCount), end, count: visibleCount, offset };
}

function tPrice(value) {
  const digits = value >= 1000 ? 2 : value >= 10 ? 3 : 5;
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function drawPanelGrid(ctx, left, width, panel, rows) {
  ctx.strokeStyle = "#202833";
  ctx.lineWidth = 1;
  for (let i = 0; i <= rows; i += 1) {
    const y = panel.top + (panel.height / rows) * i;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#141a20";
  ctx.strokeRect(left, panel.top, width, panel.height);
}

function drawPriceAxis(ctx, width, rightPad, panel, min, max) {
  ctx.fillStyle = "#8d999c";
  ctx.font = "12px Segoe UI";
  for (let i = 0; i <= 5; i += 1) {
    const y = panel.top + (panel.height / 5) * i;
    const price = max - ((max - min) / 5) * i;
    ctx.fillText(tPrice(price), width - rightPad + 10, y + 4);
  }
}

function drawSeries(ctx, values, view, x, y, color, width = 1.2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  let started = false;
  values.slice(view.start, view.end).forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    if (!started) {
      ctx.moveTo(x(index), y(value));
      started = true;
    } else {
      ctx.lineTo(x(index), y(value));
    }
  });
  if (started) ctx.stroke();
}

function drawBollinger(ctx, boll, view, x, y) {
  const rows = boll.slice(view.start, view.end);
  drawSeries(ctx, boll.map((item) => item.upper), view, x, y, "#8c97a3", 1);
  drawSeries(ctx, boll.map((item) => item.mid), view, x, y, "#9ca3af", 0.9);
  drawSeries(ctx, boll.map((item) => item.lower), view, x, y, "#8c97a3", 1);
  ctx.fillStyle = "rgba(140, 151, 163, 0.08)";
  ctx.beginPath();
  let started = false;
  rows.forEach((item, index) => {
    if (item.upper == null) return;
    if (!started) {
      ctx.moveTo(x(index), y(item.upper));
      started = true;
    } else {
      ctx.lineTo(x(index), y(item.upper));
    }
  });
  rows.slice().reverse().forEach((item, reverseIndex) => {
    if (item.lower == null) return;
    const index = rows.length - 1 - reverseIndex;
    ctx.lineTo(x(index), y(item.lower));
  });
  if (started) {
    ctx.closePath();
    ctx.fill();
  }
}

function drawHighLowMarkers(ctx, candles, x, y, formatPrice) {
  const high = candles.reduce((best, item, index) => item.high > best.value ? { value: item.high, index } : best, { value: -Infinity, index: 0 });
  const low = candles.reduce((best, item, index) => item.low < best.value ? { value: item.low, index } : best, { value: Infinity, index: 0 });
  ctx.font = "600 12px Segoe UI";
  ctx.lineWidth = 1;
  [
    { ...high, label: `H ${formatPrice(high.value)}`, direction: -1, color: "#f1f4f0" },
    { ...low, label: `L ${formatPrice(low.value)}`, direction: 1, color: "#f1f4f0" }
  ].forEach((marker) => {
    const px = x(marker.index);
    const py = y(marker.value);
    const right = marker.index < candles.length * 0.62;
    const lineEnd = px + (right ? 42 : -42);
    ctx.strokeStyle = "rgba(241, 244, 240, 0.78)";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(lineEnd, py);
    ctx.stroke();
    ctx.fillStyle = marker.color;
    ctx.textAlign = right ? "left" : "right";
    ctx.fillText(marker.label, lineEnd + (right ? 4 : -4), py + marker.direction * 4);
    ctx.textAlign = "left";
  });
}

function drawCurrentPrice(ctx, width, left, rightPad, y, price, formatPrice) {
  const py = y(price);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(46, 209, 143, 0.72)";
  ctx.beginPath();
  ctx.moveTo(left, py);
  ctx.lineTo(width - rightPad, py);
  ctx.stroke();
  ctx.setLineDash([]);
  const label = formatPrice(price);
  const labelW = ctx.measureText(label).width + 16;
  ctx.fillStyle = "#2ed18f";
  ctx.fillRect(width - rightPad + 2, py - 11, labelW, 22);
  ctx.fillStyle = "#0f1215";
  ctx.font = "700 12px Segoe UI";
  ctx.fillText(label, width - rightPad + 10, py + 4);
}

function drawRsiPanel(ctx, indicator, view, x, panel) {
  const y = (value) => panel.top + (100 - value) / 100 * panel.height;
  ctx.strokeStyle = "rgba(141, 153, 156, 0.35)";
  [30, 70].forEach((level) => {
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(10, y(level));
    ctx.lineTo(ctx.canvas.width, y(level));
    ctx.stroke();
    ctx.setLineDash([]);
  });
  drawSeries(ctx, indicator.rsi6, view, x, y, "#f1b84b", 1.2);
  drawSeries(ctx, indicator.rsi12, view, x, y, "#42c6df", 1.2);
  drawSeries(ctx, indicator.rsi24, view, x, y, "#b48cff", 1.2);
  ctx.fillStyle = "#8d999c";
  ctx.font = "12px Segoe UI";
  ctx.fillText("RSI 6/12/24", 16, panel.top + 14);
}

function drawMacdPanel(ctx, macdValues, view, x, panel, xStep) {
  const values = [
    ...macdValues.dif.slice(view.start, view.end),
    ...macdValues.dea.slice(view.start, view.end),
    ...macdValues.hist.slice(view.start, view.end)
  ].filter(Number.isFinite);
  const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 1);
  const y = (value) => panel.top + panel.height / 2 - (value / maxAbs) * (panel.height * 0.45);
  ctx.strokeStyle = "rgba(141, 153, 156, 0.35)";
  ctx.beginPath();
  ctx.moveTo(10, y(0));
  ctx.lineTo(ctx.canvas.width, y(0));
  ctx.stroke();
  macdValues.hist.slice(view.start, view.end).forEach((value, index) => {
    const positive = value >= 0;
    ctx.fillStyle = positive ? "rgba(46, 209, 143, 0.72)" : "rgba(255, 99, 99, 0.72)";
    const top = positive ? y(value) : y(0);
    const height = Math.abs(y(value) - y(0));
    ctx.fillRect(x(index) - Math.max(1, xStep * 0.36), top, Math.max(1, xStep * 0.72), Math.max(1, height));
  });
  drawSeries(ctx, macdValues.dif, view, x, y, "#f1b84b", 1.2);
  drawSeries(ctx, macdValues.dea, view, x, y, "#42c6df", 1.2);
  ctx.fillStyle = "#8d999c";
  ctx.font = "12px Segoe UI";
  ctx.fillText("MACD 12/26/9", 16, panel.top + 14);
}

function drawTimeAxis(ctx, visible, x, baseline) {
  ctx.fillStyle = "#6f7a7d";
  ctx.font = "11px Segoe UI";
  const step = Math.max(1, Math.floor(visible.length / 5));
  visible.forEach((candle, index) => {
    if (index % step !== 0 && index !== visible.length - 1) return;
    const date = new Date(candle.time);
    const label = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    ctx.fillText(label, x(index) - 24, baseline + 12);
  });
}

function drawHeader(ctx, state, analysis, last, indicator, lastIndex, left) {
  const pctChange = ((last.close - last.open) / last.open) * 100;
  const color = last.close >= last.open ? "#2ed18f" : "#ff6363";
  ctx.font = "600 12px Segoe UI";
  ctx.fillStyle = "#f1f4f0";
  ctx.fillText(`${state.asset} ${state.timeframe}  O ${tPrice(last.open)}  H ${tPrice(last.high)}  L ${tPrice(last.low)}  C ${tPrice(last.close)}`, left + 4, 16);
  ctx.fillStyle = color;
  ctx.fillText(`${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(2)}%`, left + 390, 16);
  ctx.fillStyle = "#8d999c";
  ctx.fillText(`${analysis.trend} / ${analysis.structure}`, left + 470, 16);

  const boll = indicator.boll[lastIndex] || {};
  const labels = [
    ["MA5", indicator.ma5[lastIndex], "#d9d55f"],
    ["MA10", indicator.ma10[lastIndex], "#42c6df"],
    ["MA20", indicator.ma20[lastIndex], "#f1b84b"],
    ["MA60", indicator.ma60[lastIndex], "#b48cff"],
    ["EMA12", indicator.ema12[lastIndex], "#55a7ff"],
    ["EMA26", indicator.ema26[lastIndex], "#ff7ab6"],
    ["BOLL", boll.mid, "#9ca3af"]
  ];
  let x = left + 4;
  labels.forEach(([name, value, itemColor]) => {
    if (!Number.isFinite(value)) return;
    const text = `${name} ${tPrice(value)}`;
    ctx.fillStyle = itemColor;
    ctx.fillText(text, x, 32);
    x += ctx.measureText(text).width + 14;
  });
}

function drawHover(ctx, state, visible, view, x, priceY, panels, pad, width, indicator) {
  const { hoverX, hoverY } = state.chart;
  if (hoverX == null || hoverY == null) return;
  const plotW = width - pad.left - pad.right;
  if (hoverX < pad.left || hoverX > pad.left + plotW || hoverY < panels.price.top || hoverY > panels.macd.top + panels.macd.height) return;
  const index = Math.max(0, Math.min(visible.length - 1, Math.floor((hoverX - pad.left) / (plotW / visible.length))));
  const candle = visible[index];
  const globalIndex = view.start + index;
  const cx = x(index);
  ctx.strokeStyle = "rgba(241, 244, 240, 0.28)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, panels.price.top);
  ctx.lineTo(cx, panels.macd.top + panels.macd.height);
  ctx.moveTo(pad.left, hoverY);
  ctx.lineTo(width - pad.right, hoverY);
  ctx.stroke();
  ctx.setLineDash([]);

  const boxX = cx < width * 0.55 ? cx + 14 : cx - 210;
  const boxY = panels.price.top + 14;
  ctx.fillStyle = "rgba(17, 21, 25, 0.94)";
  ctx.strokeStyle = "#303741";
  ctx.fillRect(boxX, boxY, 196, 120);
  ctx.strokeRect(boxX, boxY, 196, 120);
  ctx.font = "12px Segoe UI";
  const lines = [
    new Date(candle.time).toLocaleString("zh-CN"),
    `O ${tPrice(candle.open)}  H ${tPrice(candle.high)}`,
    `L ${tPrice(candle.low)}  C ${tPrice(candle.close)}`,
    `V ${fmtNumber(candle.volume)}`,
    `RSI6 ${formatIndicator(indicator.rsi6[globalIndex])}`,
    `DIF ${formatIndicator(indicator.macd.dif[globalIndex])}  DEA ${formatIndicator(indicator.macd.dea[globalIndex])}`
  ];
  lines.forEach((line, row) => {
    ctx.fillStyle = row === 0 ? "#f1f4f0" : "#9da7a9";
    ctx.fillText(line, boxX + 10, boxY + 18 + row * 17);
  });
}

function formatIndicator(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : "--";
}

function renderTrendTable(decision, t) {
  els.trendTable.innerHTML = Object.entries(decision.trendResults).map(([tf, item]) => `
    <tr>
      <td>${tf}</td>
      <td>${item.structure}</td>
      <td class="${item.trend === t("up") ? "positive" : item.trend === t("down") ? "negative" : "warning"}">${item.trend}</td>
      <td>${item.reversal}</td>
      <td>${item.confidence}%</td>
    </tr>
  `).join("");
}

function renderIndicators(state, decision, t) {
  const onchain = state.market.onchain;
  const derivatives = state.market.derivatives;
  els.onchainList.innerHTML = [
    [t("exchangeNetflow"), `${onchain.exchangeNetflow > 0 ? "+" : ""}${fmtNumber(onchain.exchangeNetflow)} ${state.asset}`, onchain.exchangeNetflow < 0 ? t("exchangeOutflow") : t("exchangeInflow"), onchain.exchangeNetflow < 0 ? "positive" : "negative"],
    [t("activeAddresses"), fmtNumber(onchain.activeAddresses), "Network activity proxy", "positive"],
    [t("whaleTransactions"), fmtNumber(onchain.whaleTransactions), "Large transfers can increase volatility", onchain.whaleTransactions > 900 ? "warning" : "positive"],
    [t("supplyDistribution"), pct(onchain.supplyDistribution), "Large-holder balance change", onchain.supplyDistribution > 0 ? "positive" : "negative"],
    ["MVRV", onchain.mvrv.toFixed(2), "Higher values imply profit-taking risk", onchain.mvrv > 2.35 ? "warning" : "positive"],
    ["SOPR", onchain.sopr.toFixed(3), "Above 1 means realized profit", onchain.sopr > 1.06 ? "warning" : "positive"]
  ].map(indicatorRow).join("");

  els.derivativesList.innerHTML = [
    [t("fundingRate"), `${derivatives.fundingRate}%`, "High funding means crowded longs", Math.abs(derivatives.fundingRate) > 0.04 ? "warning" : "positive"],
    [t("longShortRatio"), derivatives.longShortRatio.toFixed(2), "Crowding risk", derivatives.longShortRatio > 1.35 ? "warning" : "positive"],
    [t("liquidations"), derivatives.liquidations ? `$${fmtNumber(derivatives.liquidations)}M` : t("unavailable"), `${derivatives.liquidationBias} side pressure`, derivatives.liquidations > 190 ? "warning" : "positive"],
    [t("openInterest"), pct(derivatives.openInterestChange), "Leverage buildup proxy", derivatives.openInterestChange > 7 ? "warning" : "positive"]
  ].map(indicatorRow).join("");

  els.emotionNeedle.style.left = `${Math.max(2, Math.min(98, decision.score))}%`;
  els.trapBox.textContent = decision.trap;
}

function indicatorRow([name, value, hint, className]) {
  return `
    <div class="indicator-row">
      <div>
        <strong>${name}</strong>
        <span>${hint}</span>
      </div>
      <b class="${className}">${value}</b>
    </div>
  `;
}

function renderSources(state, t) {
  const sources = state.market?.sources || {};
  const weights = MODEL_WEIGHTS[state.settings.model] || MODEL_WEIGHTS.balanced;
  els.connectionStatus.textContent = `${t("analysisModel")}: ${t(weights.labelKey)}. ${t("providerFallback")}`;
  els.sourceGrid.innerHTML = [
    `${t("market")}: ${sources.market || providerName(state.settings.marketProvider)}`,
    `${t("onchain")}: ${sources.onchain || providerName(state.settings.onchainProvider)}`,
    `${t("derivatives")}: ${sources.derivatives || providerName(state.settings.derivativesProvider)}`,
    `Data API: ${state.settings.apiKey ? t("dataApiBound") : t("dataApiNotBound")}`
  ].map((item) => `<span>${item}</span>`).join("");
}

export function buildMarketSnapshot(state, decision, t) {
  return [
    `${t("marketSnapshot")}: ${state.asset} ${state.timeframe}`,
    `${t("model")}: ${decision.model}`,
    `${t("regime")}: ${decision.regime}, ${t("score")} ${decision.score}/100`,
    `15m: ${decision.trendResults["15m"].trend}, ${decision.trendResults["15m"].reversal}`,
    `4h: ${decision.trendResults["4h"].trend}, ${decision.trendResults["4h"].structure}`,
    `1d: ${decision.trendResults["1d"].trend}, ${decision.trendResults["1d"].structure}`,
    `${t("onchain")}: ${decision.onchainScore}/100, ${state.market.onchain.exchangeNetflow < 0 ? t("exchangeOutflow") : t("exchangeInflow")}`,
    `${t("derivatives")}: ${decision.derivativeScore}/100, ${t("fundingRate")} ${state.market.derivatives.fundingRate}%`,
    `${t("riskNote")}: ${decision.trap}`
  ].join("\n");
}

export function buildAssistantContext(state, decision) {
  return {
    asset: state.asset,
    symbol: ASSET_PROFILES[state.asset].symbol,
    timeframe: state.timeframe,
    model: decision.model,
    score: decision.score,
    regime: decision.regime,
    sentiment: decision.sentiment,
    trap: decision.trap,
    trends: decision.trendResults,
    onchain: state.market.onchain,
    derivatives: state.market.derivatives,
    sources: state.market.sources,
    updatedAt: state.market.generatedAt.toISOString()
  };
}

function updateMarketSnapshot(state, decision, t) {
  els.marketSnapshotMsg.textContent = buildMarketSnapshot(state, decision, t);
  els.marketSnapshotMsg.dataset.context = JSON.stringify(buildAssistantContext(state, decision));
}
