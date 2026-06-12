"""Infrastructure: Spotify „Now Playing".

Fragt den aktuell laufenden Track des Nutzers über die Spotify-Web-API ab.
Authentifizierung per **Refresh-Token-Flow** (serverseitig) — die OAuth-App-
Credentials kommen aus der Konfiguration und verlassen das Backend nie.

Scaffold-Status: Der Flow ist vollständig implementiert, aber erst aktiv, sobald
``spotify_client_id``/``_secret``/``_refresh_token`` gesetzt sind. Ohne
Credentials liefert ``current()`` ``{"configured": False}``.

Einrichtung des Refresh-Tokens: einmalig per Authorization-Code-Flow mit Scope
``user-read-currently-playing`` (siehe README).
"""

from __future__ import annotations

import base64
import logging
import time

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)


class SpotifyService:
    """Holt den aktuellen Spotify-Track (mit Access-Token-Caching)."""

    def __init__(self, settings: Settings) -> None:
        self._client_id = settings.spotify_client_id
        self._client_secret = settings.spotify_client_secret
        self._refresh_token = settings.spotify_refresh_token
        self._access_token: str | None = None
        self._token_expires_at = 0.0

    @property
    def configured(self) -> bool:
        return bool(self._client_id and self._client_secret and self._refresh_token)

    async def current(self) -> dict:
        """Liefert ``{configured, isPlaying, track, artist, albumArt}``."""
        if not self.configured:
            return {"configured": False}

        token = await self._access_token_valid()
        if not token:
            return {"configured": True, "isPlaying": False}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    "https://api.spotify.com/v1/me/player/currently-playing",
                    headers={"Authorization": f"Bearer {token}"},
                )
        except httpx.HTTPError as exc:
            logger.warning("Spotify-Abruf fehlgeschlagen: %s", exc)
            return {"configured": True, "isPlaying": False}

        if res.status_code == 204 or not res.content:
            return {"configured": True, "isPlaying": False}
        data = res.json()
        item = data.get("item") or {}
        images = (item.get("album") or {}).get("images") or []
        return {
            "configured": True,
            "isPlaying": bool(data.get("is_playing")),
            "track": item.get("name"),
            "artist": ", ".join(a["name"] for a in item.get("artists", [])),
            "albumArt": images[0]["url"] if images else None,
        }

    async def _access_token_valid(self) -> str | None:
        """Gibt ein gültiges Access-Token zurück (erneuert bei Bedarf)."""
        if self._access_token and time.monotonic() < self._token_expires_at:
            return self._access_token

        auth = base64.b64encode(f"{self._client_id}:{self._client_secret}".encode()).decode()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://accounts.spotify.com/api/token",
                    headers={"Authorization": f"Basic {auth}"},
                    data={"grant_type": "refresh_token", "refresh_token": self._refresh_token},
                )
                res.raise_for_status()
                token = res.json()
        except httpx.HTTPError as exc:
            logger.warning("Spotify-Token-Erneuerung fehlgeschlagen: %s", exc)
            return None

        self._access_token = token["access_token"]
        # 60 s Sicherheitsabstand vor dem tatsächlichen Ablauf.
        self._token_expires_at = time.monotonic() + token.get("expires_in", 3600) - 60
        return self._access_token
