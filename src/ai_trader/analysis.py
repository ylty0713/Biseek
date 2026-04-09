"""Market structure analysis utilities."""

from __future__ import annotations

from typing import List, Tuple, Callable

import pandas as pd

from .indicators import add_indicators


def calculate_support_resistance(df: pd.DataFrame, window: int = 20) -> Tuple[float, float]:
    highs = df["high"].astype(float)
    lows = df["low"].astype(float)
    resistance = highs.rolling(window).max().iloc[-1]
    support = lows.rolling(window).min().iloc[-1]
    return support, resistance


def detect_market_structure(df: pd.DataFrame) -> str:
    df = add_indicators(df)
    last = df.iloc[-1]

    if last["EMA20"] > last["EMA50"]:
        return "上升趋势"
    if last["EMA20"] < last["EMA50"]:
        return "下降趋势"
    return "震荡"


def estimate_long_short(df: pd.DataFrame) -> str:
    delta = df["close"].diff().iloc[-10:]
    bullish = (delta > 0).sum()
    bearish = (delta < 0).sum()

    if bullish > bearish:
        return "多头占优"
    if bearish > bullish:
        return "空头占优"
    return "多空均衡"


def analyze_liquidation_clusters(liqs: List[dict]) -> str:
    if not liqs:
        return "无数据"

    long_liq = [l["price"] for l in liqs if l.get("side") == "SELL"]  # 多头爆仓
    short_liq = [l["price"] for l in liqs if l.get("side") == "BUY"]  # 空头爆仓

    parts = []
    if long_liq:
        parts.append(f"多头爆仓集中在: {round(sum(long_liq)/len(long_liq), 2)}")
    if short_liq:
        parts.append(f"空头爆仓集中在: {round(sum(short_liq)/len(short_liq), 2)}")

    return "\n".join(parts) if parts else "无数据"


def analyze_single_tf(symbol: str, timeframe: str, df: pd.DataFrame) -> str:
    df = add_indicators(df)

    support, resistance = calculate_support_resistance(df)
    structure = detect_market_structure(df)

    last = df.iloc[-1]

    return f"""
=== {symbol} {timeframe} ===
价格: {last['close']:.2f}

趋势结构: {structure}

支撑位: {support:.2f}
阻力位: {resistance:.2f}

RSI: {last['RSI']:.2f}
MACD: {last['MACD']:.4f}
成交量: {last['volume']:.2f}
"""


def analyze_multi_tf(symbol: str, get_df: Callable[[str], pd.DataFrame]) -> str:
    """Analyze 1h/4h/1d by calling ``get_df(timeframe)`` to fetch data."""

    timeframes = ["1h", "4h", "1d"]
    result = ""

    for tf in timeframes:
        df = add_indicators(get_df(tf))

        support, resistance = calculate_support_resistance(df)
        structure = detect_market_structure(df)

        last = df.iloc[-1]

        result += f"""
=== {tf} ===
价格: {last['close']:.2f}
趋势结构: {structure}
支撑: {support:.2f}
阻力: {resistance:.2f}
RSI: {last['RSI']:.2f}
MACD: {last['MACD']:.4f}
"""

    return result
