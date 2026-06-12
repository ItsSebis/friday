"""Infrastructure: Wetter via Open-Meteo.

Fragt das aktuelle Wetter bei Open-Meteo ab — **kein API-Key nötig**. Ergebnis
wird kurz gecacht (Open-Meteo aktualisiert ohnehin nur ~alle 15 min), damit das
Frontend-Polling die API nicht unnötig belastet.

Vom Widget-Router aufgerufen (request-basiert), NICHT von Hermes gepusht.
"""

from __future__ import annotations

import logging
import time

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

# WMO-Wettercodes → kurze deutsche Beschreibung (Auszug der häufigsten).
_WMO: dict[int, str] = {
    0: "Klar", 1: "Überwiegend klar", 2: "Teils bewölkt", 3: "Bedeckt",
    45: "Nebel", 48: "Reifnebel", 51: "Leichter Niesel", 53: "Niesel",
    55: "Starker Niesel", 61: "Leichter Regen", 63: "Regen", 65: "Starker Regen",
    71: "Leichter Schnee", 73: "Schnee", 75: "Starker Schnee", 80: "Regenschauer",
    81: "Schauer", 82: "Starke Schauer", 95: "Gewitter", 96: "Gewitter mit Hagel",
}


class WeatherService:
    """Holt aktuelle Wetterdaten von Open-Meteo (mit kurzem Cache)."""

    def __init__(self, settings: Settings, cache_ttl: float = 600.0) -> None:
        self._lat = settings.weather_lat
        self._lon = settings.weather_lon
        self._tz = settings.weather_timezone
        self._cache_ttl = cache_ttl
        self._cache: dict | None = None
        self._cache_at = 0.0

    async def current(self) -> dict:
        """Liefert ``{temperatureC, condition, code}`` (gecacht)."""
        now = time.monotonic()
        if self._cache is not None and (now - self._cache_at) < self._cache_ttl:
            return self._cache

        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": self._lat,
            "longitude": self._lon,
            "current": "temperature_2m,weather_code",
            "timezone": self._tz,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params)
                res.raise_for_status()
                current = res.json().get("current", {})
        except httpx.HTTPError as exc:
            logger.warning("Wetterabruf fehlgeschlagen: %s", exc)
            return self._cache or {"temperatureC": None, "condition": None, "code": None}

        code = current.get("weather_code")
        result = {
            "temperatureC": current.get("temperature_2m"),
            "condition": _WMO.get(code, "—") if code is not None else None,
            "code": code,
        }
        self._cache, self._cache_at = result, now
        return result
