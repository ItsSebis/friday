/**
 * Domain: Das WebSocket-Nachrichtenprotokoll (Frontend-Spiegel).
 *
 * Vertrag mit `backend/app/domain/messages.py` — beide Seiten MÜSSEN synchron
 * bleiben. Jede Nachricht ist ein Envelope `{ type, payload, timestamp }`.
 */
import type { FridayState } from './states';

/** Alle bekannten Nachrichtentypen, gruppiert nach Richtung. */
export const MessageType = {
  // Server → Client
  STATE_CHANGED: 'state.changed',
  AUDIO_LEVEL: 'audio.level',
  TRANSCRIPT: 'transcript',
  RESPONSE: 'response',
  TOOL_EVENT: 'tool.event',
  DASHBOARD_UPDATE: 'dashboard.update',
  ERROR: 'error',
  // Client → Server
  CLIENT_HELLO: 'client.hello',
  UI_INTERRUPT: 'ui.interrupt',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

// ── Payload-Typen (Server → Client) ──────────────────────────────────────

export interface StateChangedPayload {
  state: FridayState;
}

export interface AudioLevelPayload {
  /** Normalisierte Amplitude 0..1 für den Visualizer. */
  level: number;
}

export interface TranscriptPayload {
  text: string;
  final: boolean;
}

export interface ResponsePayload {
  text: string;
  complete: boolean;
}

export interface ToolEventPayload {
  tool: string;
  status: 'started' | 'succeeded' | 'failed';
  detail: Record<string, unknown>;
}

export interface WeatherInfo {
  temperatureC?: number;
  condition?: string;
  icon?: string;
}

export interface SpotifyInfo {
  track?: string;
  artist?: string;
  isPlaying?: boolean;
  albumArt?: string;
}

export interface DashboardUpdatePayload {
  clock?: string;
  weather?: WeatherInfo;
  spotify?: SpotifyInfo;
}

export interface ErrorPayload {
  message: string;
  code?: string;
}

// ── Envelope & diskriminierte Union ───────────────────────────────────────

/** Generische Hülle für jede Nachricht in beide Richtungen. */
export interface Envelope<T = Record<string, unknown>> {
  type: MessageType;
  payload: T;
  timestamp?: string;
}

/**
 * Diskriminierte Union eingehender Nachrichten — ermöglicht erschöpfende
 * `switch`-Behandlung mit Typverengung im WebSocketClient/Store.
 */
export type ServerMessage =
  | Envelope<StateChangedPayload> & { type: typeof MessageType.STATE_CHANGED }
  | Envelope<AudioLevelPayload> & { type: typeof MessageType.AUDIO_LEVEL }
  | Envelope<TranscriptPayload> & { type: typeof MessageType.TRANSCRIPT }
  | Envelope<ResponsePayload> & { type: typeof MessageType.RESPONSE }
  | Envelope<ToolEventPayload> & { type: typeof MessageType.TOOL_EVENT }
  | Envelope<DashboardUpdatePayload> & { type: typeof MessageType.DASHBOARD_UPDATE }
  | Envelope<ErrorPayload> & { type: typeof MessageType.ERROR };

/** Hilfskonstruktor für ausgehende Client-Nachrichten. */
export function clientMessage<T extends Record<string, unknown>>(
  type: MessageType,
  payload: T = {} as T,
): Envelope<T> {
  return { type, payload };
}
