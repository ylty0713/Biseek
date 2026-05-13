export const $ = (selector) => document.querySelector(selector);

export const els = {
  assetSelect: $("#assetSelect"),
  riskSelect: $("#riskSelect"),
  settingsBtn: $("#settingsBtn"),
  refreshBtn: $("#refreshBtn"),
  autoRefreshBtn: $("#autoRefreshBtn"),
  canvas: $("#klineCanvas"),
  scoreValue: $("#scoreValue"),
  scoreLabel: $("#scoreLabel"),
  trendValue: $("#trendValue"),
  trendHint: $("#trendHint"),
  onchainValue: $("#onchainValue"),
  onchainHint: $("#onchainHint"),
  healthValue: $("#healthValue"),
  healthHint: $("#healthHint"),
  chartSubtitle: $("#chartSubtitle"),
  updatedAt: $("#updatedAt"),
  regimeBadge: $("#regimeBadge"),
  assistantChat: $("#assistantChat"),
  marketSnapshotMsg: $("#marketSnapshotMsg"),
  assistantInput: $("#assistantInput"),
  assistantSendBtn: $("#assistantSendBtn"),
  trendTable: $("#trendTable"),
  onchainList: $("#onchainList"),
  derivativesList: $("#derivativesList"),
  emotionNeedle: $("#emotionNeedle"),
  trapBox: $("#trapBox"),
  alarmForm: $("#alarmForm"),
  alarmSymbol: $("#alarmSymbol"),
  alarmPrice: $("#alarmPrice"),
  alarmDirection: $("#alarmDirection"),
  alarmList: $("#alarmList"),
  connectionStatus: $("#connectionStatus"),
  sourceGrid: $("#sourceGrid"),
  settingsDialog: $("#settingsDialog"),
  settingsForm: $("#settingsForm"),
  languageSelect: $("#languageSelect"),
  modelSelect: $("#modelSelect"),
  llmProviderSelect: $("#llmProviderSelect"),
  llmModelInput: $("#llmModelInput"),
  llmApiKeyInput: $("#llmApiKeyInput"),
  marketProviderSelect: $("#marketProviderSelect"),
  onchainProviderSelect: $("#onchainProviderSelect"),
  derivativesProviderSelect: $("#derivativesProviderSelect"),
  apiKeyInput: $("#apiKeyInput"),
  marketUrlInput: $("#marketUrlInput"),
  onchainUrlInput: $("#onchainUrlInput"),
  derivativesUrlInput: $("#derivativesUrlInput"),
  glassnodeUrlInput: $("#glassnodeUrlInput"),
  clearSettingsBtn: $("#clearSettingsBtn"),
  closeSettingsBtn: $("#closeSettingsBtn")
};

export function setText(selector, text) {
  const node = $(selector);
  if (node) node.textContent = text;
}

export function setPlaceholder(selector, text) {
  const node = $(selector);
  if (node) node.placeholder = text;
}
