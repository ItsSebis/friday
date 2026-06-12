"""Composition Root: FastAPI-App von Friday.

Der einzige Ort, an dem konkrete Implementierungen instanziiert und gegen ihre
Ports verdrahtet werden (Dependency Injection). Hier wird die App
zusammengesteckt — die übrigen Schichten bleiben dadurch entkoppelt und testbar.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import routes
from app.api.connection_manager import ConnectionManager
from app.api.voice import build_voice_router
from app.api.websocket import build_ws_router
from app.api.widgets import build_widgets_router
from app.application.services.audio_store import AudioStore
from app.application.services.session_service import SessionService
from app.core.config import get_settings
from app.infrastructure.audio.piper_speaker import PiperSpeaker
from app.infrastructure.audio.whisper_transcriber import WhisperTranscriber
from app.infrastructure.hermes.hermes_agent import HermesAgent
from app.infrastructure.widgets.spotify_service import SpotifyService
from app.infrastructure.widgets.weather_service import WeatherService


def create_app() -> FastAPI:
    """Application Factory: baut und konfiguriert die FastAPI-Instanz."""
    settings = get_settings()
    logging.basicConfig(level=settings.friday_log_level.upper())

    app = FastAPI(title="Friday", version="0.2.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Composition: Adapter → Ports → Services ───────────────────────
    agent = HermesAgent(settings)                 # AgentPort  → Hermes-API
    transcriber = WhisperTranscriber(settings)    # TranscriberPort → whisper.cpp
    speaker = PiperSpeaker(settings)              # SpeakerPort → piper
    manager = ConnectionManager()                 # BroadcasterPort → WebSocket
    audio_store = AudioStore()
    session = SessionService(agent, manager, speaker, audio_store)

    weather = WeatherService(settings)
    spotify = SpotifyService(settings)

    # ── Routen registrieren ───────────────────────────────────────────
    app.include_router(routes.router)
    app.include_router(build_ws_router(manager, session))
    app.include_router(build_voice_router(session, transcriber, audio_store))
    app.include_router(build_widgets_router(weather, spotify, settings.images_dir))

    # Hintergrundbilder statisch ausliefern (falls der Ordner existiert).
    images_path = Path(settings.images_dir)
    if images_path.is_dir():
        app.mount("/images", StaticFiles(directory=str(images_path)), name="images")

    # Debug-Endpoints nur in der Entwicklung (Pendant zur Frontend-Dev-Konsole).
    if settings.is_dev:
        from app.api.debug import build_debug_router

        app.include_router(build_debug_router(manager, session))

    return app


app = create_app()
