"""Launcher for AI trading assistant from repo root."""

import sys
from pathlib import Path

# Ensure src is on path
ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_trader.main import TradingAssistant  # noqa: E402


def main() -> None:
    TradingAssistant().run()


if __name__ == "__main__":
    main()
