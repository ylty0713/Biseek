"""Price alarm helper running in background threads."""

from __future__ import annotations

import threading
import time
from typing import Literal

import requests

Direction = Literal["up", "down"]


def _beep():
    try:
        import winsound

        winsound.Beep(1500, 800)
    except Exception:
        # Fallback for non-Windows: terminal bell
        print("\a", end="", flush=True)


def _monitor(symbol: str, target_price: float, direction: Direction, interval: int = 5):
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
    comp = (lambda p: p >= target_price) if direction == "up" else (lambda p: p <= target_price)

    while True:
        try:
            price = float(requests.get(url, timeout=8).json()["price"])
        except Exception:
            time.sleep(interval)
            continue

        if comp(price):
            print(
                f"🔔 价格提醒触发：{symbol} 当前 {price:.2f} {'≥' if direction=='up' else '≤'} {target_price}"
            )
            _beep()
            break

        time.sleep(interval)


def start_alarm(symbol: str, target_price: float, direction: Direction = "up") -> threading.Thread:
    """Start a background price alarm and return the thread handle."""
    t = threading.Thread(
        target=_monitor,
        args=(symbol.upper(), float(target_price), direction),
        daemon=True,
    )
    t.start()
    return t
