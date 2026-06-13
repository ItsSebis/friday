"""Application-Service: Kurzlebiger Audio-Zwischenspeicher.

Hält synthetisierte TTS-Clips (Bytes + MIME-Typ) im Speicher, bis das Frontend
sie per ``GET /voice/tts/{id}`` abgeholt hat. Bewusst klein gehalten (Ringpuffer
der letzten N Clips), da Friday typischerweise einen einzigen Kiosk-Client bedient.
"""

from __future__ import annotations

from collections import OrderedDict

# (Bytes, MIME-Typ) – z. B. WAV (piper) oder MP3 (ElevenLabs).
AudioClip = tuple[bytes, str]


class AudioStore:
    """Einfacher LRU-Speicher für Audio-Clips."""

    def __init__(self, max_items: int = 8) -> None:
        self._items: OrderedDict[str, AudioClip] = OrderedDict()
        self._max_items = max_items
        self._counter = 0

    def put(self, data: bytes, content_type: str = "audio/wav") -> str:
        """Legt einen Clip ab und gibt dessen ID zurück."""
        self._counter += 1
        audio_id = f"a{self._counter}"
        self._items[audio_id] = (data, content_type)
        while len(self._items) > self._max_items:
            self._items.popitem(last=False)
        return audio_id

    def get(self, audio_id: str) -> AudioClip | None:
        """Holt einen Clip (oder ``None``, wenn unbekannt/verdrängt)."""
        return self._items.get(audio_id)
