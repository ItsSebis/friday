/**
 * Infrastructure: Backend-URLs (WebSocket + REST).
 *
 * Eine Quelle der Wahrheit für die Backend-Adresse:
 *  1. Ist `VITE_WS_URL` gesetzt, wird sie verwendet (explizite Konfiguration).
 *  2. Sonst im **Dev-Modus** (Vite auf :5173) das Backend auf **:8000** — dort
 *     läuft uvicorn, nicht der Vite-Dev-Server.
 *  3. Sonst (Kiosk/Prod) **derselbe Origin** wie die Seite, wo Nginx `/ws`,
 *     `/voice` und `/widgets` an das Backend proxyt.
 *
 * Die REST-Basis wird aus der WS-URL abgeleitet (ws→http, `/ws` entfernt).
 */
function resolveWsUrl(): string {
  const env = import.meta.env.VITE_WS_URL;
  if (env) return env;
  if (import.meta.env.DEV) return 'ws://localhost:8000/ws';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

export const WS_URL = resolveWsUrl();

export const API_BASE = WS_URL.replace(/^ws/, 'http').replace(/\/ws$/, '');

/** Baut eine absolute Backend-URL aus einem Pfad (z. B. `/widgets/weather`). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
