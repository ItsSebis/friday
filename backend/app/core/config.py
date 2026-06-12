"""Core: Anwendungskonfiguration.

Querschnittsbelang. Liest Einstellungen aus Umgebungsvariablen / ``.env`` via
``pydantic-settings``. Wird im Composition Root (``main.py``) einmalig
instanziiert und per Dependency Injection weitergereicht.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typsichere Einstellungen aus der Umgebung."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="",
        extra="ignore",
        case_sensitive=False,
    )

    # ── Server ────────────────────────────────────────────────────────
    friday_host: str = "0.0.0.0"
    friday_port: int = 8000
    friday_log_level: str = "info"
    friday_env: str = "development"
    friday_allowed_origins: str = "http://localhost:5173,http://localhost:4173"

    # ── OpenRouter ──────────────────────────────────────────────────────
    openrouter_api_key: str = ""
    openrouter_model: str = "anthropic/claude-opus-4-8"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # ── Telegram ────────────────────────────────────────────────────────
    telegram_bot_token: str = ""
    telegram_allowed_chat_ids: str = ""

    @property
    def allowed_origins(self) -> list[str]:
        """CORS-/WS-Origins als Liste."""
        return [o.strip() for o in self.friday_allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Singleton-Zugriff auf die Settings (gecacht)."""
    return Settings()
