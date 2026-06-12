"""API: HTTP-Hilfsendpunkte.

Health-Check und Meta-Informationen. Bewusst minimal — die eigentliche
Kommunikation läuft über WebSocket.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.domain.states import FridayState

router = APIRouter(tags=["meta"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness-Probe für Container/Orchestrator."""
    return {"status": "ok"}


@router.get("/meta")
async def meta() -> dict[str, object]:
    """Statische Metadaten über die Friday-Instanz."""
    return {
        "name": "Friday",
        "states": [s.value for s in FridayState],
    }
