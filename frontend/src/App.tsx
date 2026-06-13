/**
 * App: Wurzelkomponente.
 *
 * Eine **persistente** Oberfläche (FrameView: Bilderrahmen + Dashboard). Der
 * Zustand wechselt nicht mehr die ganze Seite, sondern wird nur als kompakter
 * Indikator in der Ecke angezeigt (StatusOrb). Während eines Gesprächs blendet
 * sich das Chat-Widget ein.
 *
 * Verdrahtet außerdem Transport (WebSocket), Widget-Polling und die
 * Voice-Bridge — enthält selbst keine Businesslogik.
 */
import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWebSocket } from '@application/hooks/useWebSocket';
import { useWidgets } from '@application/hooks/useWidgets';
import { useFridayStore } from '@application/store/useFridayStore';
import { FridayState } from '@domain/states';
import { FrameView } from '@presentation/components/FrameView';
import { StatusOrb } from '@presentation/components/StatusOrb';
import { ConversationView } from '@presentation/components/ConversationView';
import { ToolPanel } from '@presentation/components/ToolPanel';
import { TalkOverlay } from '@presentation/components/TalkOverlay';

// Dev-Konsole nur im Dev-Modus laden (im Prod-Build vollständig entfernt).
const DevConsole = import.meta.env.DEV
  ? lazy(() => import('@presentation/dev/DevConsole').then((m) => ({ default: m.DevConsole })))
  : null;

export function App() {
  // Seiteneffekte: Verbindung, Widget-Polling.
  useWebSocket();
  useWidgets();

  const state = useFridayStore((s) => s.state);
  const conversing = state !== FridayState.IDLE;

  return (
    <>
      {/* Persistente Grundoberfläche. */}
      <FrameView />

      {/* Chat-Verlauf: nur während eines Gesprächs, zentral eingeblendet. */}
      <AnimatePresence>
        {conversing && (
          <motion.div
            key="conversation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: '12vh',
              bottom: '12vh',
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          >
            <ConversationView />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tool-Aktivität (z. B. während Thinking) dezent über dem Status. */}
      {conversing && (
        <div style={{ position: 'fixed', top: 64, right: 26, zIndex: 4, pointerEvents: 'none' }}>
          <ToolPanel />
        </div>
      )}

      {/* Zustands-Indikator in der Ecke. */}
      <StatusOrb />

      {/* Push-to-talk-Steuerung + Voice-Bridge (Aufnahme/STT/TTS). */}
      <TalkOverlay />

      {/* Dev-Konsole (nur im Dev-Build vorhanden). */}
      {DevConsole && (
        <Suspense fallback={null}>
          <DevConsole />
        </Suspense>
      )}
    </>
  );
}
