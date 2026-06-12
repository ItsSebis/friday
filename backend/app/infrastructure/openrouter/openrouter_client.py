"""Infrastructure: OpenRouter-LLM-Client.

Dünner Adapter um die OpenRouter-Chat-API (OpenAI-kompatibel). Kapselt
HTTP-Details, damit der Hermes-Agent provider-agnostisch bleibt.

> Grundgerüst: Keine echten Requests. Methoden sind dokumentierte Stubs.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from app.core.config import Settings

logger = logging.getLogger(__name__)


class OpenRouterClient:
    """Adapter zur OpenRouter-API."""

    def __init__(self, settings: Settings) -> None:
        self._model = settings.openrouter_model
        self._base_url = settings.openrouter_base_url
        self._api_key = settings.openrouter_api_key
        # TODO(Businesslogik): httpx.AsyncClient mit Auth-Header initialisieren.

    async def stream_chat(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """Streamt eine Chat-Completion als Text-Deltas.

        TODO(Businesslogik): POST {base_url}/chat/completions mit stream=True.
        """
        logger.info("OpenRouterClient.stream_chat(stub) model=%s", self._model)
        if False:  # pragma: no cover - Platzhalter für die spätere async-Schleife
            yield ""
