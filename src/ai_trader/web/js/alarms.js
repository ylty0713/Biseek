import { ASSET_PROFILES } from "./constants.js";
import { api } from "./api.js";
import { els } from "./dom.js";
import { addAssistantMessage } from "./assistant.js";

export async function refreshAlarms(t) {
  try {
    const data = await api("/api/alarms");
    const items = data.items || [];
    if (!items.length) {
      els.alarmList.innerHTML = `<div class="indicator-row"><div><strong>${t("noAlerts")}</strong><span>${t("noAlertsHint")}</span></div><b>--</b></div>`;
      return;
    }
    els.alarmList.innerHTML = items.map((item) => {
      const sign = item.direction === "up" ? ">=" : "<=";
      return `
        <div class="indicator-row alarm-row">
          <div>
            <strong>${item.symbol} ${sign} ${item.target_price}</strong>
            <span>${t("status")}: ${item.status} / ${t("last")}: ${item.last_price ?? "-"}</span>
          </div>
          <button class="secondary-button" data-cancel-alarm="${item.id}" type="button">${t("cancel")}</button>
        </div>
      `;
    }).join("");
  } catch {
    els.alarmList.innerHTML = `<div class="indicator-row"><div><strong>${t("alertsUnavailable")}</strong><span>${t("backendNotRunning")}</span></div><b>--</b></div>`;
  }
}

export async function createAlarm(event, state, t) {
  event.preventDefault();
  const symbol = (els.alarmSymbol.value.trim() || ASSET_PROFILES[state.asset].symbol).toUpperCase();
  const targetPrice = Number(els.alarmPrice.value);
  const direction = els.alarmDirection.value;
  if (!targetPrice) return;

  try {
    await api("/api/alarms", {
      method: "POST",
      body: JSON.stringify({ symbol, target_price: targetPrice, direction })
    });
    els.alarmPrice.value = "";
    refreshAlarms(t);
  } catch (error) {
    addAssistantMessage(`${t("alertCreateFailed")}: ${error.message}`, "bot");
  }
}

export async function cancelAlarm(id, t) {
  try {
    await api(`/api/alarms/${id}`, { method: "DELETE" });
    refreshAlarms(t);
  } catch (error) {
    addAssistantMessage(`${t("alertCancelFailed")}: ${error.message}`, "bot");
  }
}
