"""Application-Port: Sprachausgabe (TTS).

Abstrahiert die konkrete TTS-Engine (piper, Cloud …) weg von der
Anwendungslogik.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class SpeakerPort(ABC):
    """Vertrag zum Synthetisieren von Sprache."""

    @abstractmethod
    async def synthesize(self, text: str) -> bytes | None:
        """Synthetisiert Text zu WAV-Audio.

        Args:
            text: Der vorzulesende Text.

        Returns:
            WAV-Bytes oder ``None``, wenn TTS deaktiviert/nicht verfügbar ist
            (dann zeigt das Frontend nur den Text an).
        """
        raise NotImplementedError
