"""Application-Service: Kurzlebiger Audio-Zwischenspeicher.

Hält synthetisierte TTS-WAVs im Speicher, bis das Frontend sie per
``GET /voice/tts/{id}`` abgeholt hat. Bewusst klein gehalten (Ringpuffer der
letzten N Clips), da Frider typischerweise einen einzigen Kiosk-Client bedient.
"""

from __future__ import annotations

from collections import OrderedDict


class AudioStore:
    """Thread-arm: einfacher LRU-Speicher für WAV-Bytes."""

    def __init__(self, max_items: int = 8) -> None:
        self._items: OrderedDict[str, bytes] = OrderedDict()
        self._max_items = max_items
        self._counter = 0

    def put(self, wav_bytes: bytes) -> str:
        """Legt ein Audio ab und gibt dessen ID zurück."""
        self._counter += 1
        audio_id = f"a{self._counter}"
        self._items[audio_id] = wav_bytes
        while len(self._items) > self._max_items:
            self._items.popitem(last=False)
        return audio_id

    def get(self, audio_id: str) -> bytes | None:
        """Holt ein Audio (oder ``None``, wenn unbekannt/verdrängt)."""
        return self._items.get(audio_id)
