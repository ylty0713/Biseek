import { ASSET_PROFILES, MARKET_KEYWORDS } from "./constants.js";
import { api } from "./api.js";
import { els } from "./dom.js";
import { buildAiDecision } from "./analysis.js";
import { buildAssistantContext } from "./render.js";

export function detectMarketIntent(text) {
  const lower = text.toLowerCase();
  return MARKET_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function addAssistantMessage(text, type) {
  const message = document.createElement("div");
  message.className = `chat-message ${type} markdown-body`;
  if (type === "bot" && window.marked && window.DOMPurify) {
    message.innerHTML = DOMPurify.sanitize(marked.parse(text));
  } else {
    message.textContent = text;
  }
  els.assistantChat.appendChild(message);
  els.assistantChat.scrollTop = els.assistantChat.scrollHeight;
  return message;
}

export async function sendAssistantMessage(state, t) {
  const text = els.assistantInput.value.trim();
  if (!text) return;

  addAssistantMessage(text, "user");
  els.assistantInput.value = "";

  const botMsg = addAssistantMessage("", "bot");
  botMsg.innerHTML = `<span class="thinking">${t("thinking")}</span>`;

  const needsMarket = detectMarketIntent(text);
  const decision = needsMarket && state.market ? buildAiDecision(state.market, state, t) : null;
  const marketContext = decision ? buildAssistantContext(state, decision) : null;

  try {
    const data = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: text, context: marketContext })
    });
    typeEffect(botMsg, data.reply || t("noReply"));
  } catch {
    const fallback = decision
      ? buildLocalAssistantReply(text, state, decision, t)
      : "我可以聊天，也可以在后端离线时基于当前页面数据做本地分析。";
    typeEffect(botMsg, fallback);
  }
}

export function buildLocalAssistantReply(question, state, decision, t) {
  const q = question.toLowerCase();
  const focus = q.includes("onchain") || q.includes("chain") || q.includes("链")
    ? `${t("onchain")} ${decision.onchainScore}/100. ${t("exchangeNetflow")}: ${state.market.onchain.exchangeNetflow} ${state.asset}.`
    : q.includes("funding") || q.includes("future") || q.includes("合约")
      ? `${t("derivatives")} ${decision.derivativeScore}/100. ${t("fundingRate")}: ${state.market.derivatives.fundingRate}%, ${t("longShortRatio")}: ${state.market.derivatives.longShortRatio}.`
      : `${t("trend")}: 15m ${decision.trendResults["15m"].trend}, 4h ${decision.trendResults["4h"].trend}, 1d ${decision.trendResults["1d"].trend}.`;
  return [
    t("localFallback"),
    `${state.asset} (${ASSET_PROFILES[state.asset].symbol}) ${state.timeframe}`,
    focus,
    `${t("regime")}: ${decision.regime}, ${t("score")} ${decision.score}/100.`,
    decision.trap
  ].join("\n");
}

function typeEffect(element, text) {
  let index = 0;
  let current = "";
  const interval = setInterval(() => {
    current += text[index] || "";
    index += 1;
    if (window.marked && window.DOMPurify) {
      element.innerHTML = DOMPurify.sanitize(marked.parse(current));
    } else {
      element.textContent = current;
    }
    els.assistantChat.scrollTop = els.assistantChat.scrollHeight;
    if (index >= text.length) clearInterval(interval);
  }, 10);
}
