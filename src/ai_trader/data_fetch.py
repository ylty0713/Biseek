"""Data acquisition utilities (Binance endpoints)."""

from __future__ import annotations

from typing import List, Dict

import pandas as pd
import requests


def get_kline(symbol: str, interval: str, limit: int = 200) -> pd.DataFrame:
    url = "https://api.binance.com/api/v3/klines"
    params = {"symbol": symbol, "interval": interval, "limit": limit}
    data = requests.get(url, params=params, timeout=10).json()

    df = pd.DataFrame(
        data,
        columns=[
            "time",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "_1",
            "_2",
            "_3",
            "_4",
            "_5",
            "_6",
        ],
    )

    df["close"] = df["close"].astype(float)
    df["volume"] = df["volume"].astype(float)
    df["high"] = df["high"].astype(float)
    df["low"] = df["low"].astype(float)

    return df


def get_funding_rate(symbol: str = "BTCUSDT") -> float:
    url = "https://fapi.binance.com/fapi/v1/fundingRate"
    params = {"symbol": symbol, "limit": 1}
    data = requests.get(url, params=params, timeout=10).json()

    if isinstance(data, list) and len(data) > 0:
        return float(data[-1]["fundingRate"])
    return 0.0


def get_open_interest(symbol: str = "BTCUSDT") -> float:
    url = "https://fapi.binance.com/fapi/v1/openInterest"
    params = {"symbol": symbol}
    data = requests.get(url, params=params, timeout=10).json()
    return float(data.get("openInterest", 0.0))


def get_liquidations(symbol: str = "BTCUSDT") -> List[Dict[str, float | str]]:
    url = "https://fapi.binance.com/fapi/v1/allForceOrders"
    params = {"symbol": symbol, "limit": 50}

    try:
        data = requests.get(url, params=params, timeout=10).json()
    except Exception:
        return []

    liquidations = []
    for item in data:
        liquidations.append(
            {
                "price": float(item["avgPrice"]),
                "side": item["side"],  # BUY or SELL
                "qty": float(item["executedQty"]),
            }
        )

    return liquidations
