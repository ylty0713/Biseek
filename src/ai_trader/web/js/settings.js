import { DEFAULT_SETTINGS } from "./constants.js";
import { api } from "./api.js";
import { els, setPlaceholder } from "./dom.js";
import { persistSettings } from "./state.js";

export function fillSettingsForm(state) {
  els.languageSelect.value = state.settings.language;
  els.modelSelect.value = state.settings.model;
  els.llmProviderSelect.value = state.settings.llmProvider;
  els.llmModelInput.value = state.settings.llmModel;
  els.llmApiKeyInput.value = "";
  els.marketProviderSelect.value = state.settings.marketProvider;
  els.onchainProviderSelect.value = state.settings.onchainProvider;
  els.derivativesProviderSelect.value = state.settings.derivativesProvider;
  els.apiKeyInput.value = state.settings.apiKey;
  els.marketUrlInput.value = state.settings.marketUrl;
  els.onchainUrlInput.value = state.settings.onchainUrl;
  els.derivativesUrlInput.value = state.settings.derivativesUrl;
  els.glassnodeUrlInput.value = state.settings.glassnodeUrl;
}

export function readSettingsForm(state) {
  state.settings = {
    ...state.settings,
    language: els.languageSelect.value,
    model: els.modelSelect.value,
    llmProvider: els.llmProviderSelect.value,
    llmModel: els.llmModelInput.value.trim() || (els.llmProviderSelect.value === "deepseek" ? "deepseek-chat" : "gpt-4.1-mini"),
    marketProvider: els.marketProviderSelect.value,
    onchainProvider: els.onchainProviderSelect.value,
    derivativesProvider: els.derivativesProviderSelect.value,
    apiKey: els.apiKeyInput.value.trim(),
    marketUrl: els.marketUrlInput.value.trim(),
    onchainUrl: els.onchainUrlInput.value.trim(),
    derivativesUrl: els.derivativesUrlInput.value.trim(),
    glassnodeUrl: els.glassnodeUrlInput.value.trim()
  };
}

export function resetDataSettings(state) {
  state.settings = {
    ...DEFAULT_SETTINGS,
    language: state.settings.language,
    llmProvider: state.settings.llmProvider,
    llmModel: state.settings.llmModel
  };
  persistSettings();
  fillSettingsForm(state);
}

export function applyLanguage(state, t) {
  document.documentElement.lang = state.settings.language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.placeholder);
  });

  els.riskSelect.options[0].textContent = t("balancedRisk");
  els.riskSelect.options[1].textContent = t("conservative");
  els.riskSelect.options[2].textContent = t("aggressive");
  els.modelSelect.options[0].textContent = t("balancedModel");
  els.modelSelect.options[1].textContent = t("trendModel");
  els.modelSelect.options[2].textContent = t("onchainModel");
  els.modelSelect.options[3].textContent = t("derivativesModel");
  els.marketProviderSelect.options[0].textContent = t("binanceMarket");
  els.marketProviderSelect.options[1].textContent = t("customKline");
  els.onchainProviderSelect.options[0].textContent = t("mockOnchain");
  els.onchainProviderSelect.options[1].textContent = t("customJson");
  els.onchainProviderSelect.options[2].textContent = t("glassnodeTpl");
  els.derivativesProviderSelect.options[0].textContent = t("binanceFutures");
  els.derivativesProviderSelect.options[1].textContent = t("mockDerivatives");
  els.derivativesProviderSelect.options[2].textContent = t("customJson");
  els.alarmDirection.options[0].textContent = t("above");
  els.alarmDirection.options[1].textContent = t("below");
  els.settingsBtn.title = t("settings");
  els.settingsBtn.setAttribute("aria-label", t("settings"));
  els.refreshBtn.title = t("refresh");
  els.refreshBtn.setAttribute("aria-label", t("refresh"));
  setPlaceholder("#assistantInput", t("askPlaceholder"));
  setPlaceholder("#alarmPrice", t("targetPrice"));

  if (!state.market) {
    els.scoreLabel.textContent = t("waiting");
    els.trendHint.textContent = t("waiting");
    els.onchainHint.textContent = t("waiting");
    els.healthHint.textContent = t("backendUnchecked");
    els.trapBox.textContent = t("waitingSentiment");
    els.connectionStatus.textContent = t("checkingProviders");
  }
  syncAutoRefreshButton(state, t);
}

export async function saveBackendModelSettings(state, t) {
  const apiKey = els.llmApiKeyInput.value.trim();
  const payload = {
    provider: state.settings.llmProvider,
    model: state.settings.llmModel
  };
  if (apiKey) payload.api_key = apiKey;
  const data = await api("/api/settings/model", { method: "POST", body: JSON.stringify(payload) });
  els.healthValue.textContent = data.llm_ready ? t("online") : t("noKey");
  els.healthHint.textContent = `${data.provider}:${data.model}`;
}

export async function refreshHealth(state, t) {
  try {
    const data = await api("/api/health");
    els.healthValue.textContent = data.llm_ready ? t("online") : t("noKey");
    els.healthHint.textContent = `${data.provider}:${data.model} / ${t("alerts")} ${data.alarms}`;
    state.settings.llmProvider = data.provider || state.settings.llmProvider;
    state.settings.llmModel = data.model || state.settings.llmModel;
  } catch {
    els.healthValue.textContent = t("offline");
    els.healthHint.textContent = t("startBackend");
  }
}

export function syncAutoRefreshButton(state, t) {
  els.autoRefreshBtn.classList.toggle("active", state.autoRefresh);
  els.autoRefreshBtn.setAttribute("aria-pressed", String(state.autoRefresh));
  els.autoRefreshBtn.textContent = state.autoRefresh ? `${t("autoRefresh")} 1s` : `${t("autoRefresh")} off`;
}
