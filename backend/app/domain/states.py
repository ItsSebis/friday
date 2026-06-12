"""Domain: Die Zustandsmaschine von Friday.

Diese Datei ist Teil der innersten Schicht und kennt **keine** Frameworks.
Sie definiert die vier möglichen Betriebszustände sowie die erlaubten Übergänge.
Das Backend ist die alleinige *Source of Truth* für den Zustand; das Frontend
rendert lediglich, was es empfängt.
"""

from __future__ import annotations

from enum import Enum


class FridayState(str, Enum):
    """Die endlichen Betriebszustände des Bilderrahmens.

    Als ``str``-Enum, damit der Wert direkt JSON-serialisierbar ist und im
    WebSocket-Protokoll als simpler String erscheint (z. B. ``"idle"``).
    """

    IDLE = "idle"
    """Ambienter Bilderrahmenmodus: Bildrotation, Uhr, Wetter, Spotify."""

    LISTENING = "listening"
    """Nach Wakeword aktiv: nimmt Sprache auf, zeigt Audio-Visualizer."""

    THINKING = "thinking"
    """Anfrage wird vom Agenten verarbeitet (LLM / Tools)."""

    SPEAKING = "speaking"
    """Antwort wird per TTS ausgegeben und visualisiert."""


# Erlaubte Zustandsübergänge. Dient als Leitplanke für den SessionService und
# als ausführbare Dokumentation der Maschine.
ALLOWED_TRANSITIONS: dict[FridayState, set[FridayState]] = {
    FridayState.IDLE: {FridayState.LISTENING},
    FridayState.LISTENING: {FridayState.THINKING, FridayState.IDLE},
    FridayState.THINKING: {FridayState.SPEAKING, FridayState.IDLE},
    FridayState.SPEAKING: {FridayState.IDLE, FridayState.LISTENING},
}


def can_transition(source: FridayState, target: FridayState) -> bool:
    """Prüft, ob der Übergang ``source → target`` erlaubt ist."""
    return target in ALLOWED_TRANSITIONS.get(source, set())
