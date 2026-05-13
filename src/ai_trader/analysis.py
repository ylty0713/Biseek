"""Market analysis helpers."""

from __future__ import annotations

from typing import Callable

import pandas as pd

from .indicators import add_indicators


def calculate_support_resistance(df: pd.DataFrame, window: int = 20) -> tuple[float, float]:
    resistance = df["high"].astype(float).rolling(window).max().iloc[-1]
    support = df["low"].astype(float).rolling(window).min().iloc[-1]
    return float(support), float(resistance)


def detect_market_structure(df: pd.DataFrame) -> str:
    with_ma = add_indicators(df)
    last = with_ma.iloc[-1]
    if last["EMA20"] > last["EMA50"]:
        return "uptrend"
    if last["EMA20"] < last["EMA50"]:
        return "downtrend"
    return "sideways"


def estimate_long_short(df: pd.DataFrame) -> str:
    delta = df["close"].diff().iloc[-10:]
    bullish = int((delta > 0).sum())
    bearish = int((delta < 0).sum())
    if bullish > bearish:
        return "long-dominant"
    if bearish > bullish:
        return "short-dominant"
    return "balanced"


def analyze_liquidation_clusters(liqs: list[dict]) -> dict[str, float | None]:
    if not liqs:
        return {"long_cluster": None, "short_cluster": None}

    long_prices = [x["price"] for x in liqs if x.get("side") == "SELL"]
    short_prices = [x["price"] for x in liqs if x.get("side") == "BUY"]

    return {
        "long_cluster": round(sum(long_prices) / len(long_prices), 2) if long_prices else None,
        "short_cluster": round(sum(short_prices) / len(short_prices), 2) if short_prices else None,
    }


def market_snapshot(symbol: str, timeframe: str, df: pd.DataFrame) -> dict[str, float | str]:
    frame = add_indicators(df)
    support, resistance = calculate_support_resistance(frame)
    structure = detect_market_structure(frame)
    last = frame.iloc[-1]

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "price": round(float(last["close"]), 4),
        "volume": round(float(last["volume"]), 4),
        "rsi": round(float(last["RSI"]), 4),
        "macd": round(float(last["MACD"]), 6),
        "support": support,
        "resistance": resistance,
        "structure": structure,
    }


def snapshot_to_text(snapshot: dict[str, float | str]) -> str:
    return (
        f"{snapshot['symbol']} {snapshot['timeframe']}\n"
        f"price={snapshot['price']}\n"
        f"structure={snapshot['structure']}\n"
        f"support={snapshot['support']} resistance={snapshot['resistance']}\n"
        f"rsi={snapshot['rsi']} macd={snapshot['macd']} volume={snapshot['volume']}"
    )


def analyze_single_tf(symbol: str, timeframe: str, df: pd.DataFrame) -> str:
    snapshot = market_snapshot(symbol, timeframe, df)
    return snapshot_to_text(snapshot)


def analyze_multi_tf(symbol: str, get_df: Callable[[str], pd.DataFrame]) -> str:
    result: list[str] = []
    for tf in ["1h", "4h", "1d"]:
        snapshot = market_snapshot(symbol, tf, get_df(tf))
        result.append(snapshot_to_text(snapshot))
    return "\n\n".join(result)
