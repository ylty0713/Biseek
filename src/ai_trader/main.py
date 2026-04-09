"""CLI entry for AI trading assistant."""

from __future__ import annotations

from dotenv import load_dotenv

from . import ai, parsing
from .config import load_config, get_api_key, get_default_model, set_default_model
from .model_factory import choose_model, init_client
from .data_fetch import get_kline
from .alarm import start_alarm
from .parsing import parse_alarm_command
from .analysis import analyze_single_tf, analyze_multi_tf
from .utils import clean_output


class TradingAssistant:
    def __init__(self) -> None:
        load_dotenv()
        self.config = load_config()

        provider, model = get_default_model(self.config)
        if not provider or not model:
            provider, model = choose_model()
            set_default_model(self.config, provider, model)

        api_key = get_api_key(self.config, provider)
        self.client = init_client(provider, api_key)
        self.model = model
        self.provider = provider

    def switch_model(self) -> None:
        provider, model = choose_model()
        set_default_model(self.config, provider, model)
        api_key = get_api_key(self.config, provider)
        self.client = init_client(provider, api_key)
        self.model = model
        self.provider = provider
        print(f"🔄 已切换到 {provider}:{model}")

    # --------------------------- pipelines ---------------------------
    def _analyze_entry(self, parsed: dict) -> str:
        symbol = parsed["symbol"]
        timeframe = parsed["timeframe"]

        if timeframe:
            df = get_kline(symbol, timeframe)
            return analyze_single_tf(symbol, timeframe, df)

        def fetch(tf: str):
            return get_kline(symbol, tf)

        return analyze_multi_tf(symbol, fetch)

    def handle_crypto(self, query: str) -> None:
        print("📊 正在查找数据...")
        parsed = parsing.parse_user_input(query)
        market_data = self._analyze_entry(parsed)
        result = ai.ai_analysis(self.client, self.model, market_data, query)
        print("\n📊 AI分析结果：\n")
        print(clean_output(result))

    def handle_chat(self, query: str) -> None:
        reply = ai.normal_chat(self.client, self.model, query)
        print("\n🤖：", reply)

    def run(self) -> None:
        print("🚀 AI智能交易助手已启动")
        print(f"✅ 当前模型：{self.provider}:{self.model}")

        while True:
            query = input("\n👉 你：")

            alarm_cmd = parse_alarm_command(query)
            if alarm_cmd:
                start_alarm(
                    alarm_cmd["symbol"],
                    alarm_cmd["price"],
                    alarm_cmd["direction"],
                )
                arrow = "≥" if alarm_cmd["direction"] == "up" else "≤"
                print(
                    f"⏰ 已设置提醒：{alarm_cmd['symbol']} {arrow} {alarm_cmd['price']}"
                )
                continue

            if query.lower() in {"切换模型", "/switch"}:
                self.switch_model()
                continue

            intent = ai.classify_intent(self.client, self.model, query)

            if intent == "crypto":
                self.handle_crypto(query)
            else:
                self.handle_chat(query)


if __name__ == "__main__":
    TradingAssistant().run()
