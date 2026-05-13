const SOURCES = [
  { id: "binance", name: "Binance Spot", type: "CEX", status: "live" },
  { id: "coinbase", name: "Coinbase", type: "CEX", status: "not_configured" },
  { id: "chainlink", name: "Chainlink", type: "Oracle", status: "not_configured" },
  { id: "pyth", name: "Pyth", type: "Oracle", status: "not_configured" },
  { id: "redstone", name: "RedStone", type: "Oracle", status: "not_configured" },
  { id: "dydx", name: "dYdX Index", type: "Perp DEX", status: "not_configured" },
  { id: "hyperliquid", name: "Hyperliquid", type: "Perp DEX", status: "not_configured" },
  { id: "dex_twap", name: "DEX TWAP", type: "On-chain", status: "not_configured" }
];

const state = {
  asset: "BTC",
  refreshMs: 5000,
  timer: null,
  snapshots: [],
  latest: []
};

const els = {
  assetSelect: document.querySelector("#assetSelect"),
  refreshSelect: document.querySelector("#refreshSelect"),
  refreshBtn: document.querySelector("#refreshBtn"),
  fairPrice: document.querySelector("#fairPrice"),
  fairSource: document.querySelector("#fairSource"),
  maxDeviation: document.querySelector("#maxDeviation"),
  worstLatency: document.querySelector("#worstLatency"),
  riskLevel: document.querySelector("#riskLevel"),
  riskHint: document.querySelector("#riskHint"),
  chartStatus: document.querySelector("#chartStatus"),
  canvas: document.querySelector("#priceCanvas"),
  aiNotes: document.querySelector("#aiNotes"),
  sourceCards: document.querySelector("#sourceCards"),
  deviationRows: document.querySelector("#deviationRows"),
  eventList: document.querySelector("#eventList"),
  replayBtn: document.querySelector("#replayBtn"),
  replayStatus: document.querySelector("#replayStatus")
};

function symbol() {
  return `${state.asset}USDT`;
}

async function fetchBinance() {
  const started = performance.now();
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol()}`;
  const response = await fetch(url, { cache: "no-store" });
  const latency = Math.round(performance.now() - started);
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  const payload = await response.json();
  return {
    id: "binance",
    name: "Binance Spot",
    type: "CEX",
    price: Number(payload.price),
    latency,
    updatedAt: Date.now(),
    status: "ok",
    error: null
  };
}

async function loadSources() {
  const results = [];
  try {
    results.push(await fetchBinance());
  } catch (error) {
    results.push({
      id: "binance",
      name: "Binance Spot",
      type: "CEX",
      price: null,
      latency: null,
      updatedAt: null,
      status: "error",
      error: error.message
    });
  }

  for (const source of SOURCES.filter((item) => item.id !== "binance")) {
    results.push({
      ...source,
      price: null,
      latency: null,
      updatedAt: null,
      status: "not_configured",
      error: "Connector not configured. No simulated price is used."
    });
  }

  state.latest = results;
  const live = results.filter((item) => Number.isFinite(item.price));
  if (live.length) {
    state.snapshots.push({ at: Date.now(), values: live.map((item) => ({ id: item.id, price: item.price })) });
    state.snapshots = state.snapshots.slice(-120);
  }
  render();
}

function fairPrice() {
  const live = state.latest.filter((item) => Number.isFinite(item.price));
  if (!live.length) return null;
  const cex = live.filter((item) => item.type === "CEX");
  const base = cex.length ? cex : live;
  return base.reduce((sum, item) => sum + item.price, 0) / base.length;
}

function sourceHealth(item, fair) {
  if (item.status === "not_configured") return { score: "--", className: "status-warn", label: "Not configured" };
  if (item.status === "error") return { score: "0", className: "status-bad", label: "Error" };
  const deviation = fair ? Math.abs((item.price - fair) / fair) * 100 : 0;
  const latencyPenalty = Math.min(35, (item.latency || 0) / 40);
  const deviationPenalty = Math.min(45, deviation * 35);
  const score = Math.max(0, Math.round(100 - latencyPenalty - deviationPenalty));
  return {
    score: String(score),
    className: score >= 80 ? "status-ok" : score >= 60 ? "status-warn" : "status-bad",
    label: score >= 80 ? "Healthy" : score >= 60 ? "Watch" : "Risk"
  };
}

function render() {
  const fair = fairPrice();
  const live = state.latest.filter((item) => Number.isFinite(item.price));
  const deviations = live.map((item) => fair ? Math.abs((item.price - fair) / fair) * 100 : 0);
  const maxDeviation = deviations.length ? Math.max(...deviations) : null;
  const worstLatency = live.length ? Math.max(...live.map((item) => item.latency || 0)) : null;
  const errors = state.latest.filter((item) => item.status === "error");
  const missing = state.latest.filter((item) => item.status === "not_configured");

  els.fairPrice.textContent = fair ? formatPrice(fair) : "--";
  els.fairSource.textContent = live.length ? `Calculated from ${live.map((item) => item.name).join(", ")}` : "No live real source";
  els.maxDeviation.textContent = maxDeviation == null ? "--" : `${maxDeviation.toFixed(3)}%`;
  els.worstLatency.textContent = worstLatency == null ? "--" : `${worstLatency} ms`;

  const risk = computeRisk(maxDeviation, errors, missing);
  els.riskLevel.textContent = risk.level;
  els.riskLevel.className = risk.className;
  els.riskHint.textContent = risk.hint;

  renderSourceCards(fair);
  renderDeviationRows(fair);
  renderEvents(fair, maxDeviation, errors, missing);
  renderNotes(fair, maxDeviation, errors, missing);
  renderChart();
}

function renderSourceCards(fair) {
  els.sourceCards.innerHTML = state.latest.map((item) => {
    const health = sourceHealth(item, fair);
    const price = Number.isFinite(item.price) ? formatPrice(item.price) : "--";
    const meta = item.error || `Latency ${item.latency} ms`;
    return `
      <article class="source-card">
        <strong>${item.name}</strong>
        <b class="${health.className}">${health.label}</b>
        <span>${item.type}</span>
        <span>${price}</span>
        <span>${meta}</span>
        <span>Health ${health.score}</span>
      </article>
    `;
  }).join("");
}

function renderDeviationRows(fair) {
  els.deviationRows.innerHTML = state.latest.map((item) => {
    const health = sourceHealth(item, fair);
    const deviation = Number.isFinite(item.price) && fair ? `${(((item.price - fair) / fair) * 100).toFixed(4)}%` : "--";
    const freshness = item.updatedAt ? `${Math.round((Date.now() - item.updatedAt) / 1000)}s` : "--";
    return `
      <tr>
        <td>${item.name}</td>
        <td>${item.type}</td>
        <td>${Number.isFinite(item.price) ? formatPrice(item.price) : "--"}</td>
        <td>${deviation}</td>
        <td>${item.latency == null ? "--" : `${item.latency} ms`}</td>
        <td>${freshness}</td>
        <td class="${health.className}">${health.score}</td>
      </tr>
    `;
  }).join("");
}

function renderEvents(fair, maxDeviation, errors, missing) {
  const events = [];
  if (!fair) events.push(["No fair price", "No real market source is currently available."]);
  if (maxDeviation != null && maxDeviation > 0.3) events.push(["Deviation watch", `Maximum live-source deviation is ${maxDeviation.toFixed(3)}%.`]);
  for (const item of errors) events.push([`${item.name} error`, item.error]);
  if (missing.length) events.push(["Connectors pending", `${missing.length} source connectors are not configured and are not simulated.`]);
  if (!events.length) events.push(["Normal", "No active anomaly from connected real sources."]);

  els.eventList.innerHTML = events.map(([title, body]) => `
    <article class="event-item">
      <strong>${title}</strong>
      <p>${body}</p>
    </article>
  `).join("");
}

function renderNotes(fair, maxDeviation, errors, missing) {
  const lines = [];
  if (fair) lines.push(`Fair market price is ${formatPrice(fair)}, based only on connected real sources.`);
  else lines.push("No fair market price can be computed until at least one real source responds.");
  if (maxDeviation != null) lines.push(`Observed maximum deviation is ${maxDeviation.toFixed(4)}%.`);
  if (errors.length) lines.push(`Connector errors: ${errors.map((item) => item.name).join(", ")}.`);
  if (missing.length) lines.push(`${missing.length} planned connectors are intentionally marked not configured. OracleScope does not fabricate oracle prices.`);
  lines.push("Next backend step: add collector workers for Chainlink RPC, Pyth Hermes, dYdX index, and DEX TWAP, then persist ticks to a time-series database.");
  els.aiNotes.textContent = lines.join("\n");
}

function renderChart() {
  const canvas = els.canvas;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#090c0f";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const series = state.snapshots.map((snapshot) => snapshot.values.find((item) => item.id === "binance")?.price).filter(Number.isFinite);
  if (series.length < 2) {
    ctx.fillStyle = "#95a3a6";
    ctx.font = "14px Segoe UI";
    ctx.fillText("Waiting for at least two real Binance snapshots.", 24, 42);
    return;
  }

  const pad = { top: 22, right: 74, bottom: 32, left: 18 };
  const width = rect.width - pad.left - pad.right;
  const height = rect.height - pad.top - pad.bottom;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const x = (index) => pad.left + (index / Math.max(1, series.length - 1)) * width;
  const y = (price) => pad.top + (max - price) / span * height;

  ctx.strokeStyle = "#2b3440";
  for (let i = 0; i <= 4; i += 1) {
    const yy = pad.top + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(pad.left + width, yy);
    ctx.stroke();
  }

  ctx.strokeStyle = "#2ed18f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  series.forEach((price, index) => {
    if (index === 0) ctx.moveTo(x(index), y(price));
    else ctx.lineTo(x(index), y(price));
  });
  ctx.stroke();

  const last = series.at(-1);
  ctx.fillStyle = "#2ed18f";
  ctx.font = "700 12px Segoe UI";
  ctx.fillText(formatPrice(last), pad.left + width + 8, y(last) + 4);
}

function computeRisk(maxDeviation, errors, missing) {
  if (errors.length) return { level: "ERROR", className: "status-bad", hint: "At least one live connector failed" };
  if (maxDeviation != null && maxDeviation > 0.5) return { level: "HIGH", className: "status-bad", hint: "Deviation exceeds 0.5%" };
  if (maxDeviation != null && maxDeviation > 0.2) return { level: "WATCH", className: "status-warn", hint: "Deviation exceeds 0.2%" };
  if (missing.length > 4) return { level: "PARTIAL", className: "status-warn", hint: "Most oracle connectors are not configured" };
  return { level: "NORMAL", className: "status-ok", hint: "Connected real sources are within threshold" };
}

function formatPrice(value) {
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: value > 1000 ? 2 : 4 })}`;
}

function startTimer() {
  window.clearInterval(state.timer);
  state.timer = window.setInterval(loadSources, state.refreshMs);
}

els.assetSelect.addEventListener("change", () => {
  state.asset = els.assetSelect.value;
  state.snapshots = [];
  loadSources();
});

els.refreshSelect.addEventListener("change", () => {
  state.refreshMs = Number(els.refreshSelect.value);
  startTimer();
});

els.refreshBtn.addEventListener("click", loadSources);
els.replayBtn.addEventListener("click", () => {
  els.replayStatus.textContent = state.snapshots.length < 2
    ? "Collect at least two real snapshots to replay."
    : `Replaying ${state.snapshots.length} captured real snapshots in the chart.`;
  renderChart();
});

loadSources();
startTimer();
