"""API: WebSocket-Endpoint (/ws).

Interface-Adapter zwischen Transport (WebSocket) und Anwendungsschicht. Nimmt
Client-Nachrichten (UI-Events) entgegen, validiert sie gegen das Domain-Protokoll
und delegiert an den ``SessionService``. Eingehende Frames werden hier in
Domain-Begriffe übersetzt — die Anwendungsschicht kennt kein WebSocket.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.connection_manager import ConnectionManager
from app.application.services.session_service import SessionService
from app.domain.messages import Envelope, MessageType, StateChangedPayload

logger = logging.getLogger(__name__)

router = APIRouter()


def build_ws_router(manager: ConnectionManager, session: SessionService) -> APIRouter:
    """Erzeugt den WS-Router mit injizierten Abhängigkeiten (DI)."""

    @router.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        await manager.connect(websocket)
        # Initialen Zustand senden, damit der Client sofort synchron ist.
        await websocket.send_json(
            Envelope.of(
                MessageType.STATE_CHANGED, StateChangedPayload(state=session.state)
            ).model_dump(mode="json")
        )
        try:
            while True:
                raw = await websocket.receive_json()
                await _dispatch(Envelope(**raw), session)
        except WebSocketDisconnect:
            manager.disconnect(websocket)
        except Exception:  # noqa: BLE001
            logger.exception("WS-Fehler; Verbindung wird geschlossen")
            manager.disconnect(websocket)

    return router


async def _dispatch(envelope: Envelope, session: SessionService) -> None:
    """Routet eine eingehende Client-Nachricht an die Anwendungsschicht.

    TODO(Businesslogik): Weitere Client-Events ergänzen.
    """
    match envelope.type:
        case MessageType.CLIENT_HELLO:
            logger.info("client.hello: %s", envelope.payload)
        case MessageType.UI_INTERRUPT:
            await session.on_interrupt()
        case _:
            logger.debug("Ignoriere unbekannten Client-Typ: %s", envelope.type)
