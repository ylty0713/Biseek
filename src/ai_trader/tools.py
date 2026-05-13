"""Tool registry for structured capability calls."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .service import AssistantService


TOOL_SPECS: list[dict[str, Any]] = [
    {
        "name": "market_snapshot",
        "description": "Get market overview for symbol and timeframe",
        "args": {"symbol": "str", "timeframe": "str"},
    },
    {
        "name": "create_alarm",
        "description": "Create a price alarm",
        "args": {"symbol": "str", "target_price": "float", "direction": "up|down"},
    },
    {
        "name": "list_alarms",
        "description": "List alarms",
        "args": {},
    },
    {
        "name": "cancel_alarm",
        "description": "Cancel alarm by id",
        "args": {"alarm_id": "str"},
    },
]


def list_tools() -> list[dict[str, Any]]:
    return TOOL_SPECS


def run_tool(service: "AssistantService", name: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}

    if name == "market_snapshot":
        symbol = str(args.get("symbol", "BTCUSDT"))
        timeframe = str(args.get("timeframe", "1h"))
        return {"ok": True, "result": service.market_overview(symbol, timeframe)}

    if name == "create_alarm":
        symbol = str(args.get("symbol", "BTCUSDT"))
        target_price = float(args.get("target_price"))
        direction = str(args.get("direction", "up"))
        return {"ok": True, "result": service.create_alarm(symbol, target_price, direction)}

    if name == "list_alarms":
        return {"ok": True, "result": service.list_alarms()}

    if name == "cancel_alarm":
        alarm_id = str(args.get("alarm_id", ""))
        return {"ok": service.cancel_alarm(alarm_id), "result": {"alarm_id": alarm_id}}

    return {"ok": False, "error": f"Unknown tool: {name}"}
