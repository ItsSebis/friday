"""API: Debug-Endpoints (NUR Entwicklung).

Erlaubt das manuelle Auslösen von Zustandswechseln und Broadcasts über echte
WebSocket-Nachrichten — der gleiche Pfad, den später die Geschäftslogik nutzt.
Wird in ``main.py`` ausschließlich registriert, wenn ``FRIDAY_ENV=development``.

Pendant zur Frontend-Dev-Konsole (`ws …`-Befehle).
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Body, HTTPException

from app.api.connection_manager import ConnectionManager
from app.application.services.session_service import SessionService
from app.domain.messages import (
    AudioLevelPayload,
    DashboardUpdatePayload,
    Envelope,
    MessageType,
    ResponsePayload,
    ToolEventPayload,
)
from app.domain.states import FridayState


def build_debug_router(manager: ConnectionManager, session: SessionService) -> APIRouter:
    """Erzeugt den Debug-Router mit injizierten Abhängigkeiten."""
    router = APIRouter(prefix="/debug", tags=["debug"])

    @router.post("/state/{state}")
    async def set_state(state: str) -> dict[str, str]:
        """Erzwingt einen Zustand und broadcastet ihn an alle Clients."""
        try:
            target = FridayState(state)
        except ValueError as exc:
            raise HTTPException(400, f"Unbekannter Zustand: {state}") from exc
        await session.force_state(target)
        return {"state": target.value}

    @router.post("/dashboard")
    async def push_dashboard(
        payload: DashboardUpdatePayload | None = Body(default=None),
    ) -> dict[str, str]:
        """Broadcastet ein Dashboard-Update (Demo-Daten, falls kein Body)."""
        data = payload or DashboardUpdatePayload(
            clock="14:32",
            weather={"temperatureC": 21, "condition": "Teils bewölkt"},
            spotify={"track": "Back In Black", "artist": "AC/DC", "isPlaying": True},
        )
        await manager.broadcast(Envelope.of(MessageType.DASHBOARD_UPDATE, data))
        return {"ok": "dashboard"}

    @router.post("/tool/{tool}/{status}")
    async def push_tool(tool: str, status: str) -> dict[str, str]:
        """Broadcastet ein Tool-Event."""
        await manager.broadcast(
            Envelope.of(MessageType.TOOL_EVENT, ToolEventPayload(tool=tool, status=status))  # type: ignore[arg-type]
        )
        return {"ok": tool}

    @router.post("/audio/{level}")
    async def push_audio(level: float) -> dict[str, float]:
        """Broadcastet einen Audio-Pegel (0..1) für den Visualizer."""
        await manager.broadcast(
            Envelope.of(MessageType.AUDIO_LEVEL, AudioLevelPayload(level=max(0.0, min(1.0, level))))
        )
        return {"level": level}

    @router.post("/response")
    async def push_response(text: str = Body(embed=True)) -> dict[str, str]:
        """Broadcastet ein Antwort-Delta."""
        await manager.broadcast(Envelope.of(MessageType.RESPONSE, ResponsePayload(text=text)))
        return {"ok": "response"}

    @router.post("/say")
    async def say(background: BackgroundTasks, text: str = Body(embed=True)) -> dict[str, str]:
        """Stößt einen kompletten Agenten-Turn an — OHNE Mikrofon/STT.

        Isoliert die Hermes-/Orchestrierungs-Stufe von der Spracherkennung:
        Funktioniert ``say`` (thinking → speaking), aber Push-to-talk nicht,
        liegt das Problem an der STT-Stufe (whisper).
        """
        background.add_task(session.on_transcript_final, text)
        return {"ok": text}

    return router
