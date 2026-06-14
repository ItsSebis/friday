"""API: Widget-Endpoints (request-basiert).

Die Idle-Widgets holen ihre Daten selbst per Polling über diese REST-Endpoints —
**nicht** über Hermes/WebSocket. So bleiben API-Keys/OAuth serverseitig und die
ambienten Daten sind vom Agenten-Zustand entkoppelt.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter

from app.infrastructure.widgets.calendar_service import CalendarService
from app.infrastructure.widgets.spotify_service import SpotifyService
from app.infrastructure.widgets.weather_service import WeatherService

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}


def build_widgets_router(
    weather: WeatherService, spotify: SpotifyService, calendar: CalendarService, images_dir: str
) -> APIRouter:
    """Erzeugt den Widget-Router mit injizierten Diensten."""
    router = APIRouter(prefix="/widgets", tags=["widgets"])

    @router.get("/weather")
    async def get_weather() -> dict:
        """Aktuelles Wetter (Open-Meteo, gecacht)."""
        return await weather.current()

    @router.get("/spotify")
    async def get_spotify() -> dict:
        """Aktuell laufender Spotify-Track (oder ``configured: false``)."""
        return await spotify.current()

    @router.get("/calendar")
    async def get_calendar() -> dict:
        """Nächste 5 Kalenderereignisse (iCloud)."""
        events = await calendar.next_events(num=5)
        return {"events": events}

    @router.get("/images")
    async def list_images() -> dict:
        """Listet die Dateinamen der Hintergrundbilder (unter /images servt).

        Einfach Bilder in den konfigurierten Ordner legen — sie tauchen beim
        nächsten Polling automatisch in der Idle-Slideshow auf.
        """
        path = Path(images_dir)
        if not path.is_dir():
            return {"images": []}
        names = sorted(
            f.name for f in path.iterdir()
            if f.is_file() and f.suffix.lower() in _IMAGE_EXTS
        )
        return {"images": names}

    return router
