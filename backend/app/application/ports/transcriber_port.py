"""Application-Port: Spracherkennung (STT).

Abstrahiert die konkrete STT-Engine (whisper.cpp, faster-whisper, Cloud …) weg
von der Anwendungslogik.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class TranscriberPort(ABC):
    """Vertrag zum Transkribieren von Audio."""

    @abstractmethod
    async def transcribe(self, wav_bytes: bytes) -> str:
        """Transkribiert 16-kHz-Mono-WAV-Audio zu Text.

        Args:
            wav_bytes: Audio im WAV-Format (16 kHz, mono, PCM16).

        Returns:
            Den erkannten Text (leerer String, falls nichts erkannt wurde).
        """
        raise NotImplementedError
