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
from app.application.ports.speaker_port import SpeakerPort
from app.application.ports.transcriber_port import TranscriberPort
from app.application.services.audio_store import AudioStore
from app.application.services.session_service import SessionService
from app.core.config import Settings, get_settings
from app.infrastructure.audio.cloud_transcriber import CloudTranscriber
from app.infrastructure.audio.elevenlabs_speaker import ElevenLabsSpeaker
from app.infrastructure.audio.piper_speaker import PiperSpeaker
from app.infrastructure.audio.whisper_transcriber import WhisperTranscriber
from app.infrastructure.hermes.hermes_agent import HermesAgent
from app.infrastructure.widgets.calendar_service import CalendarService
from app.infrastructure.widgets.spotify_service import SpotifyService
from app.infrastructure.widgets.weather_service import WeatherService

logger = logging.getLogger(__name__)


def _build_transcriber(settings: Settings) -> TranscriberPort:
    """Wählt die STT-Implementierung anhand der Konfiguration."""
    if settings.stt_provider == "cloud" and settings.stt_api_key:
        logger.info("STT: Cloud (%s, %s)", settings.stt_api_base, settings.stt_cloud_model)
        return CloudTranscriber(settings)
    logger.info("STT: lokal (whisper.cpp)")
    return WhisperTranscriber(settings)


def _build_speaker(settings: Settings) -> SpeakerPort:
    """Wählt die TTS-Implementierung anhand der Konfiguration."""
    if settings.tts_provider == "elevenlabs" and settings.elevenlabs_api_key:
        logger.info("TTS: ElevenLabs (%s)", settings.elevenlabs_voice_id)
        return ElevenLabsSpeaker(settings)
    logger.info("TTS: lokal (piper)")
    return PiperSpeaker(settings)


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
    transcriber = _build_transcriber(settings)    # TranscriberPort → cloud|local
    speaker = _build_speaker(settings)            # SpeakerPort → elevenlabs|piper
    manager = ConnectionManager()                 # BroadcasterPort → WebSocket
    audio_store = AudioStore()
    session = SessionService(agent, manager, speaker, audio_store)

    weather = WeatherService(settings)
    spotify = SpotifyService(settings)
    calendar = CalendarService(settings)

    # ── Routen registrieren ───────────────────────────────────────────
    app.include_router(routes.router)
    app.include_router(build_ws_router(manager, session))
    app.include_router(build_voice_router(session, transcriber, audio_store))
    app.include_router(build_widgets_router(weather, spotify, calendar, settings.images_dir))

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
