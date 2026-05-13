"""Shared application service for CLI and Web."""

from __future__ import annotations

import json
from typing import Any

from . import ai
from .alarm import get_alarm_manager, start_alarm
from .analysis import analyze_liquidation_clusters, market_snapshot, snapshot_to_text
from .config import get_api_key, get_default_model, load_config, set_default_model
from .data_fetch import (
    DataFetchError,
    get_funding_rate,
    get_kline,
    get_liquidations,
    get_open_interest,
    get_price,
)
from .model_factory import init_client
from .parsing import parse_alarm_command, parse_user_input
from .utils import clean_output


class AssistantService:
    def __init__(self, prompt_for_key: bool = False) -> None:
        self.config = load_config()

        provider, model = get_default_model(self.config)
        if not provider:
            provider = "openai"
        if not model:
            model = "gpt-4.1-mini"

        self.provider = provider
        self.model = model
        self.client = None
        self._runtime_api_key: str | None = None

        self._init_client(prompt_for_key=prompt_for_key)

    def _init_client(self, prompt_for_key: bool) -> None:
        key = self._runtime_api_key or get_api_key(self.config, self.provider, prompt_if_missing=prompt_for_key)
        if not key:
            self.client = None
            return
        self.client = init_client(self.provider, key)

    def switch_model(self, provider: str, model: str, api_key: str | None = None) -> dict:
        self.provider = provider
        self.model = model
        set_default_model(self.config, provider, model)

        if api_key:
            self._runtime_api_key = api_key

        self._init_client(prompt_for_key=False)
        return {"provider": self.provider, "model": self.model, "llm_ready": self.client is not None}

    def health(self) -> dict:
        return {
            "provider": self.provider,
            "model": self.model,
            "llm_ready": self.client is not None,
            "alarms": len(get_alarm_manager().list_all()),
        }

    def market_overview(self, symbol: str, timeframe: str) -> dict:
        timeframe = timeframe or "1h"
        df = get_kline(symbol, timeframe)
        snap = market_snapshot(symbol.upper(), timeframe, df)
        snap["data_source"] = "binance"
        data_errors: list[str] = []
        snap["funding_rate"] = self._optional_market_value(
            lambda: get_funding_rate(symbol), None, "funding_rate", data_errors
        )
        snap["open_interest"] = self._optional_market_value(
            lambda: get_open_interest(symbol), None, "open_interest", data_errors
        )
        snap["spot_price"] = self._optional_market_value(
            lambda: get_price(symbol), float(snap["price"]), "spot_price", data_errors
        )
        liquidations = self._optional_market_value(
            lambda: get_liquidations(symbol), [], "liquidations", data_errors
        )
        snap["liquidation_clusters"] = analyze_liquidation_clusters(liquidations)
        if data_errors:
            snap["data_errors"] = data_errors
        return snap

    def analyze(self, user_query: str, symbol: str | None = None, timeframe: str | None = None) -> dict:
        parsed = parse_user_input(user_query)

        symbol = symbol or parsed.get("symbol")
        timeframe = timeframe or parsed.get("timeframe")

        # 拒绝分析
        if not symbol:
            return {
                "market_data": None,
                "analysis": "No symbol detected. Please specify a cryptocurrency (e.g., BTC, ETH).",
                "mode": "no_symbol"
            }

        overview = self.market_overview(symbol, timeframe)
        market_data = snapshot_to_text(overview)

        if self.client is None:
            fallback = (
                "LLM is not ready (missing API key or connection issue). "
                "Here is market snapshot only."
            )
            return {"market_data": overview, "analysis": fallback, "mode": "fallback"}

        try:
            result = ai.ai_analysis(self.client, self.model, market_data, user_query)
            return {"market_data": overview, "analysis": clean_output(result), "mode": "llm"}
        except ai.LLMUnavailableError as exc:
            msg = f"LLM temporarily unavailable: {exc}. Returned snapshot-only response."
            return {"market_data": overview, "analysis": msg, "mode": "fallback"}

    def chat(self, message: str, context: dict[str, Any] | None = None) -> dict:

        alarm_cmd = parse_alarm_command(message)
        if alarm_cmd:
            alarm = start_alarm(
                symbol=str(alarm_cmd["symbol"]),
                target_price=float(alarm_cmd["price"]),
                direction=str(alarm_cmd["direction"]),
            )
            sign = ">=" if alarm["direction"] == "up" else "<="
            return {
                "type": "alarm",
                "reply": f"Alarm created: {alarm['symbol']} {sign} {alarm['target_price']} (id={alarm['id']})",
                "alarm": alarm,
            }

        if self.client is None:
            if context:
                return {
                    "type": "chat",
                    "reply": self._context_fallback_reply(context),
                    "mode": "fallback",
                }
            return {
                "type": "chat",
                "reply": "LLM not configured. Set API key in config.json or environment.",
            }

        try:
            # 🚨 ================================
            # 🔒 核心修复：强制隔离 context
            # ================================

            # ① 解析用户是否明确提到币种
            parsed = parse_user_input(message)
            symbol = parsed.get("symbol")

            # ② intent（保留你的逻辑）
            intent = ai.classify_intent(self.client, self.model, message)

            # ③ 🔥 最关键：统一“是否进入分析模式”
            is_market_query = (
                symbol is not None and intent == "crypto"
            )

            # ================================
            # 🟢 CHAT MODE（绝对不带数据）
            # ================================
            if not is_market_query:
                # 🚫 强制忽略任何 context（防污染）
                reply = ai.normal_chat(self.client, self.model, message)
                return {
                    "type": "chat",
                    "reply": reply
                }

            # ================================
            # 🔵 MARKET MODE（才分析）
            # ================================
            overview = {
                "15m": self.market_overview(symbol, "15m"),
                "1h": self.market_overview(symbol, "1h"),
                "4h": self.market_overview(symbol, "4h"),
                "1d": self.market_overview(symbol, "1d"),
            }
            analysis_text = json.dumps(overview, ensure_ascii=False)

            reply = ai.ai_analysis(
                self.client,
                self.model,
                analysis_text,
                message
            )

            return {
                "type": "analysis",
                "reply": clean_output(reply),
                "market_data": overview
            }

        except ai.LLMUnavailableError as exc:
            return {"type": "chat", "reply": f"LLM error: {exc}"}
        except DataFetchError as exc:
            return {"type": "chat", "reply": f"真实行情数据请求失败：{exc}"}

    def create_alarm(self, symbol: str, target_price: float, direction: str) -> dict:
        return start_alarm(symbol, target_price, direction)  # type: ignore[arg-type]

    def list_alarms(self) -> list[dict]:
        return get_alarm_manager().list_all()

    def cancel_alarm(self, alarm_id: str) -> bool:
        return get_alarm_manager().cancel(alarm_id)

    @staticmethod
    def _optional_market_value(fetch_fn, fallback, label: str, errors: list[str]):
        try:
            return fetch_fn()
        except DataFetchError as exc:
            errors.append(f"{label}: {exc}")
            return fallback

    @staticmethod
    def _context_fallback_reply(context: dict[str, Any]) -> str:
        asset = context.get("asset", "asset")
        timeframe = context.get("timeframe", "timeframe")
        score = context.get("score", "-")
        regime = context.get("regime", "unknown")
        trap = context.get("trap", "No trap signal available.")
        onchain = context.get("onchain") or {}
        derivatives = context.get("derivatives") or {}
        trends = context.get("trends") or {}
        tf_view = trends.get(timeframe) or trends.get("4h") or {}

        return (
            f"LLM is not configured, so this is a deterministic fallback analysis.\n"
            f"{asset} {timeframe}: regime={regime}, score={score}/100.\n"
            f"Trend: {tf_view.get('trend', '-')}, structure={tf_view.get('structure', '-')}, "
            f"reversal={tf_view.get('reversal', '-')}.\n"
            f"On-chain: exchange netflow={onchain.get('exchangeNetflow', '-')}, "
            f"MVRV={onchain.get('mvrv', '-')}, SOPR={onchain.get('sopr', '-')}.\n"
            f"Derivatives: funding={derivatives.get('fundingRate', '-')}%, "
            f"long/short={derivatives.get('longShortRatio', '-')}.\n"
            f"Risk note: {trap}"
        )
