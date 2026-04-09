"""Lightweight parsing helpers for user inputs."""

from __future__ import annotations

import re
from typing import Dict, Optional


def parse_user_input(query: str) -> Dict[str, Optional[str]]:
    """Identify symbol, timeframe, and intent keywords from a query."""

    q = query.lower()

    # 币种识别
    symbol_map = {
        "比特币": "BTCUSDT",
        "btc": "BTCUSDT",
        "以太坊": "ETHUSDT",
        "eth": "ETHUSDT",
        "sol": "SOLUSDT",
        "solana": "SOLUSDT",
        "bnb": "BNBUSDT",
    }

    symbol = "BTCUSDT"
    for k, v in symbol_map.items():
        if k in q:
            symbol = v
            break

    # 周期识别
    timeframe_map = {
        "1h": "1h",
        "1小时": "1h",
        "4h": "4h",
        "4小时": "4h",
        "1d": "1d",
        "日线": "1d",
        "周线": "1w",
    }

    timeframe = None
    for k, v in timeframe_map.items():
        if k in q:
            timeframe = v
            break

    # 意图识别
    if any(word in q for word in ["做多", "多单", "long"]):
        intent = "long"
    elif any(word in q for word in ["做空", "空单", "short"]):
        intent = "short"
    else:
        intent = "analyze"

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "intent": intent,
    }


def parse_alarm_command(query: str):
    """Parse alarm command like “提醒比特币超过71000”.

    Returns dict {symbol, price, direction} or None if not matched.
    direction is \"up\" for >=, \"down\" for <=.
    """

    q = query.lower()

    # must mention alert related word to avoid误触发
    if not any(word in q for word in ["提醒", "闹钟", "报警", "alert", "alarm"]):
        return None

    symbol_map = {
        "btc": "BTCUSDT",
        "比特币": "BTCUSDT",
        "eth": "ETHUSDT",
        "以太坊": "ETHUSDT",
        "sol": "SOLUSDT",
        "solana": "SOLUSDT",
        "bnb": "BNBUSDT",
    }

    symbol = None
    for k, v in symbol_map.items():
        if k in q:
            symbol = v
            break

    price_match = re.search(r"(\d+(?:\.\d+)?)", q)
    if not symbol or not price_match:
        return None

    price = float(price_match.group(1))

    if any(word in q for word in ["超过", "高于", "大于", ">=", "突破", "上涨到", "以上"]):
        direction = "up"
    elif any(word in q for word in ["低于", "小于", "跌破", "<=", "跌到", "以下"]):
        direction = "down"
    else:
        direction = "up"

    return {"symbol": symbol, "price": price, "direction": direction}
