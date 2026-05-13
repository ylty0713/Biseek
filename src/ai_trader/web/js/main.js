import { ASSET_PROFILES } from "./constants.js";
import { translate } from "./i18n.js";
import { state, persistSettings } from "./state.js";
import { els } from "./dom.js";
import { RealDataProvider } from "./providers.js";
import { getVisibleRange, render, renderMarketError } from "./render.js";
import { addAssistantMessage, sendAssistantMessage } from "./assistant.js";
import { cancelAlarm, createAlarm, refreshAlarms } from "./alarms.js";
import {
  applyLanguage,
  fillSettingsForm,
  readSettingsForm,
  refreshHealth,
  resetDataSettings,
  saveBackendModelSettings,
  syncAutoRefreshButton
} from "./settings.js";

const t = (key) => translate(state.settings, key);

async function reloadMarket() {
  if (state.loading) return;
  state.loading = true;
  try {
    const provider = new RealDataProvider(state.settings);
    state.market = await provider.load(state.asset);
    render(state, t);
  } catch (error) {
    state.market = null;
    els.connectionStatus.textContent = `真实行情数据获取失败：${error.message}`;
    renderMarketError(error.message, t);
  } finally {
    state.loading = false;
  }
}

function startAutoRefresh() {
  window.clearInterval(state.refreshTimer);
  state.refreshTimer = window.setInterval(reloadMarket, state.refreshIntervalMs);
  state.autoRefresh = true;
  syncAutoRefreshButton(state, t);
}

function stopAutoRefresh() {
  window.clearInterval(state.refreshTimer);
  state.refreshTimer = null;
  state.autoRefresh = false;
  syncAutoRefreshButton(state, t);
}

function bindEvents() {
  document.querySelectorAll("[data-timeframe]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-timeframe]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.timeframe = button.dataset.timeframe;
      state.chart.offsetFromRight = 0;
      render(state, t);
    });
  });

  els.assetSelect.addEventListener("change", (event) => {
    state.asset = event.target.value;
    state.chart.offsetFromRight = 0;
    els.alarmSymbol.value = ASSET_PROFILES[state.asset].symbol;
    reloadMarket();
  });
  els.riskSelect.addEventListener("change", (event) => {
    state.risk = event.target.value;
    render(state, t);
  });
  els.refreshBtn.addEventListener("click", () => {
    reloadMarket();
    refreshHealth(state, t);
    refreshAlarms(t);
  });
  els.settingsBtn.addEventListener("click", () => {
    fillSettingsForm(state);
    els.settingsDialog.showModal();
  });
  els.closeSettingsBtn.addEventListener("click", () => els.settingsDialog.close());
  els.autoRefreshBtn.addEventListener("click", () => {
    if (state.autoRefresh) stopAutoRefresh();
    else {
      startAutoRefresh();
      reloadMarket();
    }
  });
  els.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    readSettingsForm(state);
    persistSettings();
    applyLanguage(state, t);
    try {
      await saveBackendModelSettings(state, t);
    } catch (error) {
      addAssistantMessage(`${t("llmSettingsFailed")}: ${error.message}`, "bot");
    }
    els.settingsDialog.close();
    reloadMarket();
    refreshHealth(state, t);
  });
  els.languageSelect.addEventListener("change", () => {
    state.settings.language = els.languageSelect.value;
    persistSettings();
    applyLanguage(state, t);
    render(state, t);
    refreshHealth(state, t);
    refreshAlarms(t);
  });
  els.clearSettingsBtn.addEventListener("click", () => {
    resetDataSettings(state);
    applyLanguage(state, t);
    reloadMarket();
  });
  els.assistantSendBtn.addEventListener("click", () => sendAssistantMessage(state, t));
  els.assistantInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendAssistantMessage(state, t);
  });
  els.alarmForm.addEventListener("submit", (event) => createAlarm(event, state, t));
  els.alarmList.addEventListener("click", (event) => {
    const id = event.target?.dataset?.cancelAlarm;
    if (id) cancelAlarm(id, t);
  });
  window.addEventListener("resize", () => render(state, t));
  bindChartPointerEvents();
}

function bindChartPointerEvents() {
  els.canvas.addEventListener("wheel", (event) => {
    const candles = currentCandles();
    if (!candles.length) return;
    event.preventDefault();
    const rect = els.canvas.getBoundingClientRect();
    const left = 10;
    const right = 86;
    const plotW = Math.max(120, rect.width - left - right);
    const cursorRatio = Math.max(0, Math.min(1, (event.clientX - rect.left - left) / plotW));
    const oldRange = getVisibleRange(state, candles.length);
    const oldCount = oldRange.count;
    const zoomFactor = event.deltaY > 0 ? 1.14 : 0.86;
    const newCount = Math.max(24, Math.min(candles.length, Math.round(oldCount * zoomFactor)));
    const anchorIndex = oldRange.start + cursorRatio * oldCount;
    const newStart = anchorIndex - cursorRatio * newCount;
    const newEnd = newStart + newCount;
    state.chart.visibleCount = newCount;
    state.chart.offsetFromRight = clampOffset(candles.length - newEnd, candles.length, newCount);
    render(state, t);
  }, { passive: false });

  els.canvas.addEventListener("mousedown", (event) => {
    state.chart.dragging = true;
    state.chart.dragStartX = event.clientX;
    state.chart.dragStartOffset = state.chart.offsetFromRight;
    els.canvas.classList.add("dragging");
  });
  window.addEventListener("mouseup", () => {
    state.chart.dragging = false;
    els.canvas.classList.remove("dragging");
  });
  els.canvas.addEventListener("mousemove", (event) => {
    const rect = els.canvas.getBoundingClientRect();
    state.chart.hoverX = event.clientX - rect.left;
    state.chart.hoverY = event.clientY - rect.top;
    if (state.chart.dragging) {
      const candles = currentCandles();
      const range = getVisibleRange(state, candles.length);
      const plotW = Math.max(120, rect.width - 10 - 86);
      const xStep = plotW / range.count;
      const delta = Math.round((event.clientX - state.chart.dragStartX) / xStep);
      state.chart.offsetFromRight = clampOffset(state.chart.dragStartOffset + delta, candles.length, range.count);
    }
    render(state, t);
  });
  els.canvas.addEventListener("mouseleave", () => {
    state.chart.hoverX = null;
    state.chart.hoverY = null;
    state.chart.dragging = false;
    els.canvas.classList.remove("dragging");
    render(state, t);
  });
}

function currentCandles() {
  return state.market?.kline?.[state.timeframe] || [];
}

function clampOffset(value, length, visibleCount) {
  return Math.max(0, Math.min(Math.max(0, length - visibleCount), Math.round(value)));
}

function boot() {
  bindEvents();
  els.alarmSymbol.value = ASSET_PROFILES[state.asset].symbol;
  fillSettingsForm(state);
  applyLanguage(state, t);
  reloadMarket();
  refreshHealth(state, t);
  refreshAlarms(t);
  startAutoRefresh();
  window.setInterval(() => refreshHealth(state, t), 12000);
  window.setInterval(() => refreshAlarms(t), 5000);
}

boot();
