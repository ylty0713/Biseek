"""Configuration utilities for the trading assistant.

This module isolates reading/writing of the JSON config so other modules
can stay pure and testable.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Tuple


CONFIG_FILE = Path("config.json")


def load_config() -> Dict[str, Any]:
    """Load user configuration from ``config.json`` if it exists.

    Empty or malformed files return an empty config instead of crashing.
    """

    if not CONFIG_FILE.exists():
        return {}

    try:
        content = CONFIG_FILE.read_text(encoding="utf-8").strip()
        if not content:
            return {}
        return json.loads(content)
    except Exception:
        # Be conservative: never let config loading take down the app.
        return {}


def save_config(config: Dict[str, Any]) -> None:
    """Persist the configuration to disk."""
    CONFIG_FILE.write_text(json.dumps(config, indent=4), encoding="utf-8")


def get_api_key(config: Dict[str, Any], provider: str, prompt_fn=input) -> str:
    """Fetch an API key from config or ask the user via ``prompt_fn``.

    ``prompt_fn`` defaults to ``input`` but can be replaced for tests.
    """

    key_name = f"{provider}_api_key"

    if key_name in config:
        return config[key_name]

    api_key = prompt_fn(f"🔑 请输入 {provider} API Key：")
    config[key_name] = api_key
    save_config(config)
    return api_key


def get_default_model(config: Dict[str, Any]) -> Tuple[str | None, str | None]:
    """Return stored (provider, model) if present."""
    if "default_model" in config and "provider" in config:
        return config["provider"], config["default_model"]
    return None, None


def set_default_model(config: Dict[str, Any], provider: str, model: str) -> None:
    """Persist the default model choice for the next session."""
    config["provider"] = provider
    config["default_model"] = model
    save_config(config)
