/**
 * Application: Widget-Polling.
 *
 * Holt die ambienten Idle-Daten **request-basiert** über die REST-Endpoints des
 * Backends (nicht über Hermes/WebSocket) und schreibt sie über denselben
 * Reducer wie Server-Nachrichten in den Store. Wetter selten, Spotify häufig.
 */
import { useEffect } from 'react';
import { apiUrl } from '@infrastructure/http/api';
import { useFridayStore } from '@application/store/useFridayStore';
import { MessageType, type ServerMessage } from '@domain/messages';

const WEATHER_INTERVAL_MS = 10 * 60 * 1000; // 10 min
const SPOTIFY_INTERVAL_MS = 10 * 1000; //       10 s
const CALENDAR_INTERVAL_MS = 5 * 60 * 1000; //   5 min
const IMAGES_INTERVAL_MS = 60 * 1000; //        60 s (neue Bilder erkennen)

export function useWidgets() {
  const apply = useFridayStore((s) => s.applyServerMessage);
  const setImages = useFridayStore((s) => s.setImages);

  useEffect(() => {
    let active = true;

    const dispatch = (payload: ServerMessage['payload']) =>
      active && apply({ type: MessageType.DASHBOARD_UPDATE, payload } as ServerMessage);

    const fetchWeather = async () => {
      try {
        const res = await fetch(apiUrl('/widgets/weather'));
        const w = await res.json();
        dispatch({ weather: { temperatureC: w.temperatureC, condition: w.condition } });
      } catch (err) {
        // Backend offline/falsche URL → Daten behalten; im Dev sichtbar machen.
        if (import.meta.env.DEV) console.warn('[widgets] weather:', err);
      }
    };

    const fetchSpotify = async () => {
      try {
        const res = await fetch(apiUrl('/widgets/spotify'));
        const s = await res.json();
        if (s?.configured) {
          dispatch({
            spotify: {
              track: s.track,
              artist: s.artist,
              isPlaying: s.isPlaying,
              albumArt: s.albumArt,
            },
          });
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[widgets] spotify:', err);
      }
    };

    const fetchCalendar = async () => {
      try {
        const res = await fetch(apiUrl('/widgets/calendar'));
        const c = await res.json();
        if (c?.events) {
          dispatch({ calendar: { events: c.events } });
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[widgets] calendar:', err);
      }
    };

    const fetchImages = async () => {
      try {
        const res = await fetch(apiUrl('/widgets/images'));
        const data = await res.json();
        if (active && Array.isArray(data.images)) {
          setImages(data.images.map((name: string) => apiUrl(`/images/${name}`)));
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[widgets] images:', err);
      }
    };

    void fetchWeather();
    void fetchSpotify();
    void fetchCalendar();
    void fetchImages();
    const weatherId = setInterval(fetchWeather, WEATHER_INTERVAL_MS);
    const spotifyId = setInterval(fetchSpotify, SPOTIFY_INTERVAL_MS);
    const calendarId = setInterval(fetchCalendar, CALENDAR_INTERVAL_MS);
    const imagesId = setInterval(fetchImages, IMAGES_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(weatherId);
      clearInterval(spotifyId);
      clearInterval(calendarId);
      clearInterval(imagesId);
    };
  }, [apply, setImages]);
}
