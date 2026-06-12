"""Infrastructure: Telegram-Gateway.

Ein Hermes-Tool/Kanal, um Nachrichten via Telegram zu senden/empfangen.

> Grundgerüst: Dokumentierter Stub ohne Netzwerkzugriff.
"""

from __future__ import annotations

import logging

from app.core.config import Settings

logger = logging.getLogger(__name__)


class TelegramGateway:
    """Adapter zur Telegram-Bot-API."""

    def __init__(self, settings: Settings) -> None:
        self._token = settings.telegram_bot_token
        self._allowed_chat_ids = [
            c.strip() for c in settings.telegram_allowed_chat_ids.split(",") if c.strip()
        ]
        # TODO(Businesslogik): Bot-Client / Polling oder Webhook aufsetzen.

    async def send_message(self, chat_id: str, text: str) -> None:
        """Sendet eine Nachricht (Stub)."""
        logger.info("TelegramGateway.send_message(stub) chat=%s", chat_id)
