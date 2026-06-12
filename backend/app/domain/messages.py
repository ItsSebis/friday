"""Domain: Das WebSocket-Nachrichtenprotokoll.

Definiert den Vertrag zwischen Backend und Frontend. Dieselbe Struktur ist im
Frontend unter ``frontend/src/domain/messages.ts`` gespiegelt — beide Seiten
MÜSSEN synchron gehalten werden.

Jede Nachricht ist ein *Envelope*:

    { "type": <MessageType>, "payload": {...}, "timestamp": <iso-8601> }

``type`` bestimmt das Schema von ``payload``. Wir nutzen ein flaches, explizites
Protokoll statt RPC, weil Friday primär einen unidirektionalen Zustands-Stream
(Server → Client) plus einige UI-Events (Client → Server) braucht.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.domain.states import FridayState


class MessageType(str, Enum):
    """Alle bekannten Nachrichtentypen, gruppiert nach Richtung."""

    # ── Server → Client ───────────────────────────────────────────────
    STATE_CHANGED = "state.changed"      # Zustandswechsel der Maschine
    AUDIO_LEVEL = "audio.level"          # Amplitude für den Visualizer (0..1)
    TRANSCRIPT = "transcript"            # erkannter Nutzertext (partial/final)
    RESPONSE = "response"                # Agenten-Antwort (delta/complete)
    TOOL_EVENT = "tool.event"            # Tool-Aufruf-Status für Tool-Panels
    AUDIO_SPEAK = "audio.speak"          # Frontend soll TTS-Audio abspielen
    DASHBOARD_UPDATE = "dashboard.update"  # Uhr / Wetter / Spotify
    ERROR = "error"                      # Fehler zur Anzeige

    # ── Client → Server ───────────────────────────────────────────────
    CLIENT_HELLO = "client.hello"        # Handshake nach Verbindungsaufbau
    LISTEN_START = "listen.start"        # Nutzer startet Aufnahme (Push-to-talk/Wakeword)
    LISTEN_CANCEL = "listen.cancel"      # Aufnahme abgebrochen ohne Senden
    SPEAK_DONE = "speak.done"            # TTS-Wiedergabe im Frontend beendet
    UI_INTERRUPT = "ui.interrupt"        # Nutzer bricht Ausgabe ab (Touch/Klick)


# ── Payload-Schemata (Server → Client) ────────────────────────────────────


class StateChangedPayload(BaseModel):
    """Neuer Betriebszustand."""
    state: FridayState


class AudioLevelPayload(BaseModel):
    """Normalisierte Audio-Amplitude zur Steuerung des Visualizers."""
    level: float = Field(ge=0.0, le=1.0)


class TranscriptPayload(BaseModel):
    """Erkannter Nutzertext. ``final=False`` für Zwischenergebnisse."""
    text: str
    final: bool = False


class ResponsePayload(BaseModel):
    """Antwort des Agenten. ``complete=True`` markiert das letzte Delta."""
    text: str
    complete: bool = False


class ToolEventPayload(BaseModel):
    """Status eines Tool-Aufrufs für die Tool-Panels im Frontend."""
    tool: str
    status: Literal["started", "succeeded", "failed"]
    detail: dict[str, Any] = Field(default_factory=dict)


class AudioSpeakPayload(BaseModel):
    """Weist das Frontend an, die TTS-Antwort abzuspielen.

    ``audio_url`` ist ``None``, wenn TTS deaktiviert/nicht verfügbar ist — dann
    zeigt das Frontend nur ``text`` an und meldet ``speak.done`` selbst.
    """
    audio_url: str | None = None
    text: str = ""


class DashboardUpdatePayload(BaseModel):
    """Partielles Update der Idle-Widgets. Felder optional → nur Deltas senden."""
    clock: str | None = None
    weather: dict[str, Any] | None = None
    spotify: dict[str, Any] | None = None


class ErrorPayload(BaseModel):
    """Anzeigbare Fehlermeldung."""
    message: str
    code: str | None = None


# ── Envelope ───────────────────────────────────────────────────────────────


class Envelope(BaseModel):
    """Einheitliche Hülle für jede Nachricht in beide Richtungen.

    ``payload`` bleibt absichtlich ``dict`` — die typisierten Schemata oben
    dienen der Validierung an den Rändern (API-Layer), während der Domain-Kern
    nur den Envelope kennt.
    """

    type: MessageType
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: str | None = None

    @classmethod
    def of(cls, type_: MessageType, payload: BaseModel | dict[str, Any] | None = None) -> "Envelope":
        """Bequemer Konstruktor aus einem Pydantic-Payload oder Dict."""
        if isinstance(payload, BaseModel):
            payload = payload.model_dump(mode="json")
        return cls(type=type_, payload=payload or {})
