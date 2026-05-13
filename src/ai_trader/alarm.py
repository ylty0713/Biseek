"""Background alert manager for price alarms."""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Literal

from .data_fetch import DataFetchError, get_price

Direction = Literal["up", "down"]
Status = Literal["active", "triggered", "cancelled", "error"]


@dataclass
class AlarmItem:
    id: str
    symbol: str
    target_price: float
    direction: Direction
    status: Status
    created_at: str
    triggered_at: str | None = None
    last_price: float | None = None
    error: str | None = None


class AlarmManager:
    def __init__(self, poll_interval_sec: float = 3.0) -> None:
        self.poll_interval_sec = poll_interval_sec
        self._alarms: dict[str, AlarmItem] = {}
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def create(self, symbol: str, target_price: float, direction: Direction) -> AlarmItem:
        item = AlarmItem(
            id=str(uuid.uuid4())[:8],
            symbol=symbol.upper(),
            target_price=float(target_price),
            direction=direction,
            status="active",
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        with self._lock:
            self._alarms[item.id] = item
        return item

    def list_all(self) -> list[dict]:
        with self._lock:
            alarms = [asdict(x) for x in self._alarms.values()]
        alarms.sort(key=lambda x: x["created_at"], reverse=True)
        return alarms

    def cancel(self, alarm_id: str) -> bool:
        with self._lock:
            item = self._alarms.get(alarm_id)
            if not item:
                return False
            if item.status == "active":
                item.status = "cancelled"
            return True

    def _worker(self) -> None:
        while not self._stop_event.is_set():
            with self._lock:
                active = [x for x in self._alarms.values() if x.status == "active"]

            # group by symbol to reduce requests
            symbols = sorted({x.symbol for x in active})
            prices: dict[str, float] = {}
            for symbol in symbols:
                try:
                    prices[symbol] = get_price(symbol)
                except DataFetchError as exc:
                    prices[symbol] = float("nan")
                    with self._lock:
                        for item in active:
                            if item.symbol == symbol:
                                item.error = str(exc)

            now = datetime.now(timezone.utc).isoformat()
            with self._lock:
                for item in active:
                    price = prices.get(item.symbol)
                    if price is None or price != price:  # NaN check
                        continue
                    item.last_price = price
                    trigger = (price >= item.target_price) if item.direction == "up" else (price <= item.target_price)
                    if trigger:
                        item.status = "triggered"
                        item.triggered_at = now
                        self._beep()

            time.sleep(self.poll_interval_sec)

    def shutdown(self) -> None:
        self._stop_event.set()
        self._thread.join(timeout=2)

    @staticmethod
    def _beep() -> None:
        try:
            import winsound

            winsound.Beep(1400, 700)
        except Exception:
            print("\a", end="", flush=True)


_alarm_manager: AlarmManager | None = None


def get_alarm_manager() -> AlarmManager:
    global _alarm_manager
    if _alarm_manager is None:
        _alarm_manager = AlarmManager()
    return _alarm_manager


def start_alarm(symbol: str, target_price: float, direction: Direction = "up") -> dict:
    item = get_alarm_manager().create(symbol, target_price, direction)
    return asdict(item)
