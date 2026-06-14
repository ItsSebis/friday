"""Core: Anwendungskonfiguration.

Querschnittsbelang. Liest Einstellungen aus Umgebungsvariablen / ``.env`` via
``pydantic-settings``. Wird im Composition Root (``main.py``) einmalig
instanziiert und per Dependency Injection weitergereicht.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typsichere Einstellungen aus der Umgebung."""

    model_config = SettingsConfigDict(
        # .env wird sowohl im Repo-Root (lokal: `cd backend && uvicorn …`) als auch
        # im Backend-Verzeichnis gesucht; spätere Datei hat Vorrang. Echte
        # Umgebungsvariablen (z. B. via docker-compose) überschreiben beide.
        # Zusätzliche .icloud_env im Home-Verzeichnis wird ebenfalls geladen.
        env_file=(str(Path.home() / ".icloud_env"), "../.env", ".env"),
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

    # ── Hermes Agent (OpenAI-kompatibler API-Server) ──────────────────
    # Hermes verwaltet die LLM-Anbindung (OpenRouter) intern; unser Backend
    # spricht ausschließlich den Hermes-Server an.
    hermes_base_url: str = "http://localhost:8642"
    hermes_api_key: str = "change-me-local-dev"
    hermes_model: str = "hermes-agent"
    hermes_system_prompt: str = (
        "Du bist FRIDAY, ein hilfsbereiter, knapper Sprachassistent in einem "
        "Bilderrahmen. Antworte natürlich und kurz, da deine Antworten "
        "vorgelesen werden."
    )
    hermes_request_timeout: float = 120.0

    # ── STT (Spracherkennung) ─────────────────────────────────────────
    # Provider: "cloud" (genau, empfohlen) oder "local" (whisper.cpp, privat).
    stt_provider: str = "local"
    stt_language: str = "de"
    # Cloud (OpenAI-kompatibel: Groq=kostenlos/schnell, oder OpenAI).
    stt_api_base: str = "https://api.groq.com/openai/v1"
    stt_api_key: str = ""
    stt_cloud_model: str = "whisper-large-v3-turbo"
    # Lokal (whisper.cpp).
    stt_binary: str = "whisper-cli"          # whisper.cpp CLI im PATH
    stt_model: str = "../docker/models/ggml-base.bin"  # Pfad zum ggml-Modell

    # ── TTS (Sprachausgabe) ───────────────────────────────────────────
    # Provider: "elevenlabs" (natürlich, Key nötig) oder "piper" (lokal).
    tts_enabled: bool = True
    tts_provider: str = "piper"
    # ElevenLabs (natürlichste feminine Stimme).
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" – natürlich, feminin
    elevenlabs_model: str = "eleven_multilingual_v2"
    elevenlabs_output_format: str = "mp3_44100_128"
    # Lokal (piper). Lokal relativ zum Backend-CWD; im Docker → /models/...
    tts_binary: str = "piper"
    tts_voice: str = "../docker/models/de_DE-kerstin-low.onnx"

    # ── Hintergrundbilder (Idle-Slideshow) ───────────────────────────
    # Ordner, in den einfach Bilder gelegt werden. Lokal relativ zum
    # Backend-CWD (Repo-Root/assets/images), im Docker per Volume → /images.
    images_dir: str = "../assets/images"

    # ── Widgets ───────────────────────────────────────────────────────
    # Wetter via Open-Meteo (kein API-Key nötig).
    weather_lat: float = 52.52
    weather_lon: float = 13.405
    weather_timezone: str = "auto"
    # Spotify (Now Playing) – optionale OAuth-Credentials.
    spotify_client_id: str = ""
    spotify_client_secret: str = ""
    spotify_refresh_token: str = ""
    # iCloud Kalender
    icloud_apple_id: str = ""
    icloud_app_password: str = ""

    @property
    def allowed_origins(self) -> list[str]:
        """CORS-/WS-Origins als Liste."""
        return [o.strip() for o in self.friday_allowed_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.friday_env == "development"


@lru_cache
def get_settings() -> Settings:
    """Singleton-Zugriff auf die Settings (gecacht)."""
    return Settings()
