import { DEFAULT_SETTINGS, SETTINGS_KEY } from "./constants.js";

export const state = {
  asset: "BTC",
  risk: "balanced",
  timeframe: "15m",
  market: null,
  loading: false,
  chart: {
    visibleCount: 96,
    offsetFromRight: 0,
    dragging: false,
    dragStartX: 0,
    dragStartOffset: 0,
    hoverX: null,
    hoverY: null
  },
  autoRefresh: true,
  refreshIntervalMs: 1000,
  refreshTimer: null,
  settings: loadSettings()
};

export function loadSettings() {
  try {
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") });
  } catch {
    return normalizeSettings({ ...DEFAULT_SETTINGS });
  }
}

export function persistSettings() {
  const { llmApiKey, ...safeSettings } = state.settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(safeSettings));
}

function normalizeSettings(settings) {
  return {
    ...settings,
    marketProvider: settings.marketProvider === "mock" ? "binance" : settings.marketProvider
  };
}
