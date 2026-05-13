"""Configuration helpers for AI trader."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

CONFIG_FILE = Path("config.json")


def load_config() -> dict[str, Any]:
    """Load JSON config; return empty dict on any parse/read error."""
    if not CONFIG_FILE.exists():
        return {}
    try:
        raw = CONFIG_FILE.read_text(encoding="utf-8").strip()
        if not raw:
            return {}
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
        return {}
    except Exception:
        return {}


def save_config(config: dict[str, Any]) -> None:
    CONFIG_FILE.write_text(
        json.dumps(config, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def get_default_model(config: dict[str, Any]) -> tuple[str | None, str | None]:
    provider = config.get("provider")
    model = config.get("default_model")
    if isinstance(provider, str) and isinstance(model, str):
        return provider, model
    return None, None


def set_default_model(config: dict[str, Any], provider: str, model: str) -> None:
    for key in list(config):
        if key.endswith("_api_key"):
            config.pop(key, None)
    config["provider"] = provider
    config["default_model"] = model
    save_config(config)


def _env_key_name(provider: str) -> str:
    return "OPENAI_API_KEY" if provider == "openai" else f"{provider.upper()}_API_KEY"


def get_api_key(
    config: dict[str, Any],
    provider: str,
    prompt_if_missing: bool = True,
    prompt_fn=input,
) -> str | None:
    """Resolve API key from env or prompt without persisting secrets to config."""
    env_key = os.getenv(_env_key_name(provider), "").strip()
    if env_key:
        return env_key

    if not prompt_if_missing:
        return None

    user_key = prompt_fn(f"Please input {provider} API key: ").strip()
    if not user_key:
        return None
    return user_key
