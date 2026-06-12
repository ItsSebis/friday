/**
 * Application: Globaler UI-State (Zustand-Store).
 *
 * Single Source of Truth des Frontends. Die Präsentationsschicht liest hier und
 * rendert; eingehende Server-Nachrichten werden über `applyServerMessage` in den
 * Store übersetzt. Keine UI-Imports — reiner Zustand + Reducer-artige Aktionen.
 */
import { create } from 'zustand';
import { FridayState, isFridayState } from '@domain/states';
import {
  MessageType,
  type DashboardUpdatePayload,
  type ServerMessage,
  type ToolEventPayload,
} from '@domain/messages';

interface DashboardState {
  clock: string | null;
  weather: DashboardUpdatePayload['weather'] | null;
  spotify: DashboardUpdatePayload['spotify'] | null;
}

interface FridayStore {
  // ── Zustand ──────────────────────────────────────────────────────
  /** Aktueller Betriebszustand (vom Backend gesetzt). */
  state: FridayState;
  /** Ob die WebSocket-Verbindung steht. */
  connected: boolean;
  /** Geglättete Audio-Amplitude 0..1 für den Visualizer. */
  audioLevel: number;
  /** Zuletzt erkannter Nutzertext. */
  transcript: string;
  /** Aktuell akkumulierte Agenten-Antwort. */
  response: string;
  /** Letztes Tool-Event (für Tool-Panels). */
  lastToolEvent: ToolEventPayload | null;
  /** Idle-Dashboard-Daten. */
  dashboard: DashboardState;
  /** Letzte Fehlermeldung. */
  error: string | null;

  // ── Aktionen ─────────────────────────────────────────────────────
  setConnected: (connected: boolean) => void;
  /** Übersetzt eine eingehende Server-Nachricht in State-Mutationen. */
  applyServerMessage: (message: ServerMessage) => void;
}

const initialDashboard: DashboardState = {
  clock: null,
  weather: null,
  spotify: null,
};

export const useFridayStore = create<FridayStore>((set) => ({
  state: FridayState.IDLE,
  connected: false,
  audioLevel: 0,
  transcript: '',
  response: '',
  lastToolEvent: null,
  dashboard: initialDashboard,
  error: null,

  setConnected: (connected) => set({ connected }),

  applyServerMessage: (message) =>
    set((prev) => {
      switch (message.type) {
        case MessageType.STATE_CHANGED: {
          const next = message.payload.state;
          if (!isFridayState(next)) return prev;
          // Bei jedem neuen Listening-Zyklus Transkript/Antwort zurücksetzen.
          return next === FridayState.LISTENING
            ? { state: next, transcript: '', response: '' }
            : { state: next };
        }
        case MessageType.AUDIO_LEVEL:
          return { audioLevel: message.payload.level };
        case MessageType.TRANSCRIPT:
          return { transcript: message.payload.text };
        case MessageType.RESPONSE:
          return message.payload.complete
            ? prev
            : { response: prev.response + message.payload.text };
        case MessageType.TOOL_EVENT:
          return { lastToolEvent: message.payload };
        case MessageType.DASHBOARD_UPDATE:
          return {
            dashboard: {
              clock: message.payload.clock ?? prev.dashboard.clock,
              weather: message.payload.weather ?? prev.dashboard.weather,
              spotify: message.payload.spotify ?? prev.dashboard.spotify,
            },
          };
        case MessageType.ERROR:
          return { error: message.payload.message };
        default:
          return prev;
      }
    }),
}));
