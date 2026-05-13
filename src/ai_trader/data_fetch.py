"""Data acquisition utilities (Binance endpoints)."""

from __future__ import annotations

import os
from typing import Any

import pandas as pd
import requests

HTTP_TIMEOUT = 10
_SESSION = requests.Session()
_disable_market_proxy = os.getenv("AI_TRADER_MARKET_TRUST_ENV_PROXY", "").strip().lower() in {"0", "false", "no"}
_SESSION.trust_env = not _disable_market_proxy


class DataFetchError(RuntimeError):
    """Raised when upstream market data request fails."""


def _get_json(label: str, url: str, params: dict[str, Any] | None = None) -> Any:
    try:
        response = _SESSION.get(url, params=params, timeout=HTTP_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        proxy_state = "enabled" if _SESSION.trust_env else "disabled"
        raise DataFetchError(
            f"{label} request failed: url={url}, params={params or {}}, "
            f"env_proxy={proxy_state}, error={type(exc).__name__}: {exc}"
        ) from exc


def get_price(symbol: str) -> float:
    payload = _get_json(
        "spot price",
        "https://api.binance.com/api/v3/ticker/price",
        {"symbol": symbol.upper()},
    )
    return float(payload["price"])


def get_kline(symbol: str, interval: str, limit: int = 200) -> pd.DataFrame:
    data = _get_json(
        "spot kline",
        "https://api.binance.com/api/v3/klines",
        {"symbol": symbol.upper(), "interval": interval, "limit": limit},
    )

    df = pd.DataFrame(
        data,
        columns=[
            "time",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "close_time",
            "quote_asset_volume",
            "trade_count",
            "taker_buy_base",
            "taker_buy_quote",
            "ignore",
        ],
    )

    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = df[col].astype(float)

    return df


def get_funding_rate(symbol: str = "BTCUSDT") -> float:
    data = _get_json(
        "funding rate",
        "https://fapi.binance.com/fapi/v1/fundingRate",
        {"symbol": symbol.upper(), "limit": 1},
    )
    if isinstance(data, list) and data:
        return float(data[-1]["fundingRate"])
    return 0.0


def get_open_interest(symbol: str = "BTCUSDT") -> float:
    data = _get_json(
        "open interest",
        "https://fapi.binance.com/fapi/v1/openInterest",
        {"symbol": symbol.upper()},
    )
    return float(data.get("openInterest", 0.0))


def get_liquidations(symbol: str = "BTCUSDT", limit: int = 50) -> list[dict[str, float | str]]:
    data = _get_json(
        "liquidations",
        "https://fapi.binance.com/fapi/v1/allForceOrders",
        {"symbol": symbol.upper(), "limit": limit},
    )

    result: list[dict[str, float | str]] = []
    if not isinstance(data, list):
        return result

    for item in data:
        try:
            result.append(
                {
                    "price": float(item["avgPrice"]),
                    "side": item["side"],
                    "qty": float(item["executedQty"]),
                }
            )
        except Exception:
            continue

    return result
