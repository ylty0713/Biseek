"""User input parsing helpers."""

from __future__ import annotations

import re
from typing import Optional

SYMBOL_MAP = {
    "bitcoin": "BTCUSDT",
    "btc": "BTCUSDT",
    "比特币": "BTCUSDT",
    "ethereum": "ETHUSDT",
    "eth": "ETHUSDT",
    "以太坊": "ETHUSDT",
    "sol": "SOLUSDT",
    "solana": "SOLUSDT",
    "bnb": "BNBUSDT",
}

TIMEFRAME_MAP = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
    "1小时": "1h",
    "4h": "4h",
    "4小时": "4h",
    "1d": "1d",
    "日线": "1d",
    "1w": "1w",
    "周线": "1w",
    "月线": "1M",
}


def _pick_symbol(text: str) -> str:
    q = text.lower()
    for key, value in SYMBOL_MAP.items():
        if key in q:
            return value
    return None


def _pick_timeframe(text: str) -> Optional[str]:
    if "1M" in text or "月线" in text:
        return "1M"
    q = text.lower()
    for key, value in TIMEFRAME_MAP.items():
        if key in q:
            return value
    return None


def parse_user_input(query: str) -> dict[str, Optional[str]]:
    q = query.lower()
    intent = "analyze"
    if any(word in q for word in ["做多", "多单", "long"]):
        intent = "long"
    elif any(word in q for word in ["做空", "空单", "short"]):
        intent = "short"

    return {
        "symbol": _pick_symbol(query),
        "timeframe": _pick_timeframe(query),
        "intent": intent,
    }


def parse_alarm_command(query: str) -> Optional[dict[str, str | float]]:
    """Parse alert commands.

    Example inputs:
    - 帮我设置比特币价格超过71000时的提醒
    - alert btc above 71000
    """
    q = query.lower()

    if not any(token in q for token in ["提醒", "闹钟", "报警", "alert", "alarm"]):
        return None

    symbol = _pick_symbol(query)

    match = re.search(r"(\d+(?:\.\d+)?)", q)
    if not match:
        return None
    price = float(match.group(1))

    if any(token in q for token in ["超过", "高于", "大于", ">=", "above", "up", "突破", "以上"]):
        direction = "up"
    elif any(token in q for token in ["低于", "小于", "跌破", "<=", "below", "down", "以下"]):
        direction = "down"
    else:
        direction = "up"

    return {
        "symbol": symbol,
        "price": price,
        "direction": direction,
    }
