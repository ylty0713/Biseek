"""CLI entry for AI trading assistant."""

from __future__ import annotations

from .service import AssistantService


class TradingAssistant:
    def __init__(self) -> None:
        self.service = AssistantService(prompt_for_key=True)

    def run(self) -> None:
        print("AI Trading Assistant started")
        print(
            f"Model: {self.service.provider}:{self.service.model} | "
            f"LLM ready: {self.service.client is not None}"
        )

        while True:
            query = input("\nYou: ").strip()
            if not query:
                continue

            if query.lower() in {"exit", "quit", "/q"}:
                print("Bye.")
                break

            if query.lower() in {"/health", "health"}:
                print(self.service.health())
                continue

            response = self.service.chat(query)
            print(f"\nAssistant: {response.get('reply', '')}")


if __name__ == "__main__":
    TradingAssistant().run()
