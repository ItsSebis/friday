/**
 * Application: Bridge-Hook zwischen WebSocketClient und Store.
 *
 * Baut beim Mount genau eine WebSocket-Verbindung auf, leitet eingehende
 * Nachrichten in den Store und meldet Verbindungsänderungen. Gibt einen
 * `send`-Callback für ausgehende UI-Events zurück.
 */
import { useEffect, useRef } from 'react';
import { WebSocketClient } from '@infrastructure/websocket/WebSocketClient';
import { useFridayStore } from '@application/store/useFridayStore';
import { clientMessage, MessageType, type Envelope } from '@domain/messages';

/** Liest die WS-URL aus der Vite-Umgebung (Fallback: localhost). */
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/ws';

export function useWebSocket() {
  const clientRef = useRef<WebSocketClient | null>(null);
  const applyServerMessage = useFridayStore((s) => s.applyServerMessage);
  const setConnected = useFridayStore((s) => s.setConnected);

  useEffect(() => {
    const client = new WebSocketClient({
      url: WS_URL,
      onMessage: applyServerMessage,
      onStatusChange: (connected) => {
        setConnected(connected);
        if (connected) {
          client.send(clientMessage(MessageType.CLIENT_HELLO, { client: 'kiosk' }));
        }
      },
    });
    client.connect();
    clientRef.current = client;
    return () => client.disconnect();
  }, [applyServerMessage, setConnected]);

  /** Sendet ein UI-Event an das Backend (z. B. Interrupt). */
  const send = <T extends Record<string, unknown>>(message: Envelope<T>) =>
    clientRef.current?.send(message);

  return { send };
}
