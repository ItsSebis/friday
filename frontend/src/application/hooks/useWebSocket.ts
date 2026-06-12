/**
 * Application: Bridge-Hook zwischen WebSocketClient und Store.
 *
 * Baut beim Mount genau eine WebSocket-Verbindung auf, leitet eingehende
 * Nachrichten in den Store und meldet Verbindungsänderungen. Gibt einen
 * `send`-Callback für ausgehende UI-Events zurück.
 */
import { useEffect, useRef } from 'react';
import { WebSocketClient } from '@infrastructure/websocket/WebSocketClient';
import { WS_URL } from '@infrastructure/http/api';
import { useFridayStore } from '@application/store/useFridayStore';
import { clientMessage, MessageType, type Envelope } from '@domain/messages';

export function useWebSocket() {
  const clientRef = useRef<WebSocketClient | null>(null);
  const applyServerMessage = useFridayStore((s) => s.applyServerMessage);
  const setConnected = useFridayStore((s) => s.setConnected);
  const registerSender = useFridayStore((s) => s.registerSender);

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
    // Sendefunktion im Store registrieren, damit beliebige Komponenten
    // (Interrupt-Button, Dev-Konsole) Client-Nachrichten senden können.
    registerSender((m) => client.send(m));
    return () => {
      registerSender(null);
      client.disconnect();
    };
  }, [applyServerMessage, setConnected, registerSender]);

  /** Sendet ein UI-Event an das Backend (z. B. Interrupt). */
  const send = <T extends Record<string, unknown>>(message: Envelope<T>) =>
    clientRef.current?.send(message);

  return { send };
}
