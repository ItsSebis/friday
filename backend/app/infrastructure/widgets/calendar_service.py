"""Kalender-Widget-Dienst: Holt die nächsten X Ereignisse aus iCloud."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
import os
import caldav
from icalendar import Calendar

from app.core.config import Settings

logger = logging.getLogger(__name__)

TARGET_CALENDARS = {
    "Privat",
    "Leo und Sebi",
    "Mami und Sebi",
    "Familie"
}

class CalendarService:
    def __init__(self, settings: Settings) -> None:
        # Priorisiere explizite Umgebungsvariablen, falle dann auf Settings zurück
        self.apple_id = os.environ.get("ICLOUD_APPLE_ID") or getattr(settings, "icloud_apple_id", "")
        self.app_password = os.environ.get("ICLOUD_APP_PASSWORD") or getattr(settings, "icloud_app_password", "")
        self._client = None

    def _get_client(self):
        if not self.apple_id or not self.app_password:
            logger.warning("iCloud-Kalender deaktiviert: ICLOUD_APPLE_ID oder ICLOUD_APP_PASSWORD fehlen.")
            return None
        if self._client is None:
            try:
                url = "https://caldav.icloud.com/"
                self._client = caldav.DAVClient(url, username=self.apple_id, password=self.app_password)
            except Exception as e:
                logger.error(f"Fehler beim Initialisieren des iCloud-Clients: {e}")
                return None
        return self._client

    async def next_events(self, num: int = 5, days: int = 14) -> list[dict]:
        """Gibt die nächsten `num` Ereignisse als Liste von Dicts zurück."""
        client = self._get_client()
        if not client:
            return []

        try:
            principal = client.principal()
            calendars = principal.calendars()
        except Exception as e:
            logger.error(f"Fehler bei der Verbindung zu iCloud: {e}")
            return []

        events = []
        now = datetime.now(timezone.utc)
        end_date = now + timedelta(days=days)

        for cal in calendars:
            cal_name = cal.get_display_name()
            if cal_name in TARGET_CALENDARS:
                try:
                    all_events = cal.events()
                    for event in all_events:
                        ical_data = event.data
                        cal_obj = Calendar.from_ical(ical_data)
                        for component in cal_obj.walk():
                            if component.name == "VEVENT":
                                summary = component.get('summary')
                                dtstart = component.get('dtstart')
                                
                                if dtstart:
                                    start_dt = dtstart.dt
                                    if isinstance(start_dt, datetime):
                                        if start_dt.tzinfo is None:
                                            start_dt = start_dt.replace(tzinfo=timezone.utc)
                                    else:
                                        start_dt = datetime.combine(start_dt, datetime.min.time(), tzinfo=timezone.utc)
                                    
                                    if now <= start_dt <= end_date:
                                        events.append({
                                            'calendar': cal_name,
                                            'start': start_dt,
                                            'summary': str(summary) if summary else "Kein Titel"
                                        })
                except Exception as e:
                    logger.warning(f"Kalender '{cal_name}' konnte nicht gelesen werden: {e}")

        events.sort(key=lambda x: x['start'])
        result = []
        for ev in events[:num]:
            is_all_day = ev['start'].hour == 0 and ev['start'].minute == 0
            result.append({
                "calendar": ev["calendar"],
                "start": ev["start"].strftime("%d.%m.%Y %H:%M") if not is_all_day else ev["start"].strftime("%d.%m.%Y"),
                "is_all_day": is_all_day,
                "summary": ev["summary"]
            })
        return result
