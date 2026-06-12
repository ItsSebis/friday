"""Composition Root: FastAPI-App von Friday.

Der einzige Ort, an dem konkrete Implementierungen instanziiert und gegen ihre
Ports verdrahtet werden (Dependency Injection). Hier wird die App
zusammengesteckt — die übrigen Schichten bleiben dadurch entkoppelt und testbar.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes
from app.api.connection_manager import ConnectionManager
from app.api.websocket import build_ws_router
from app.application.services.session_service import SessionService
from app.core.config import get_settings
from app.infrastructure.hermes.hermes_agent import HermesAgent
from app.infrastructure.openrouter.openrouter_client import OpenRouterClient


def create_app() -> FastAPI:
    """Application Factory: baut und konfiguriert die FastAPI-Instanz."""
    settings = get_settings()
    logging.basicConfig(level=settings.friday_log_level.upper())

    app = FastAPI(title="Friday", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Composition: Adapter → Ports → Service ────────────────────────
    llm = OpenRouterClient(settings)
    agent = HermesAgent(llm)
    manager = ConnectionManager()             # erfüllt BroadcasterPort
    session = SessionService(agent, manager)  # erfüllt den Anwendungsfall

    # ── Routen registrieren ───────────────────────────────────────────
    app.include_router(routes.router)
    app.include_router(build_ws_router(manager, session))

    return app


app = create_app()
