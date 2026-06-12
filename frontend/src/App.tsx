/**
 * App: Wurzelkomponente / Screen-Router.
 *
 * - Stellt über `useWebSocket` die Verbindung zum Backend her.
 * - Wählt anhand des `state` aus dem Store genau einen Screen.
 * - Übergänge zwischen Screens animiert `AnimatePresence` (sanftes Cross-Fade).
 *
 * Die Komponente enthält bewusst keine Businesslogik – sie verdrahtet nur
 * Transport, State und Präsentation.
 */
import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWebSocket } from '@application/hooks/useWebSocket';
import { useWidgets } from '@application/hooks/useWidgets';
import { useFridayStore } from '@application/store/useFridayStore';
import { FridayState } from '@domain/states';
import { IdleScreen } from '@presentation/screens/IdleScreen';
import { ListeningScreen } from '@presentation/screens/ListeningScreen';
import { ThinkingScreen } from '@presentation/screens/ThinkingScreen';
import { SpeakingScreen } from '@presentation/screens/SpeakingScreen';
import { TalkOverlay } from '@presentation/components/TalkOverlay';
import { ConversationView } from '@presentation/components/ConversationView';

// Dev-Konsole nur im Dev-Modus laden. Der dynamische Import liegt hinter einer
// statisch auswertbaren Bedingung → im Produktions-Build wird der Code
// vollständig entfernt (tree-shaking).
const DevConsole = import.meta.env.DEV
  ? lazy(() => import('@presentation/dev/DevConsole').then((m) => ({ default: m.DevConsole })))
  : null;

/** Mapt jeden Zustand auf seinen Screen (erschöpfend). */
const SCREENS: Record<FridayState, () => JSX.Element> = {
  [FridayState.IDLE]: IdleScreen,
  [FridayState.LISTENING]: ListeningScreen,
  [FridayState.THINKING]: ThinkingScreen,
  [FridayState.SPEAKING]: SpeakingScreen,
};

export function App() {
  // Verbindung aufbauen + Idle-Widgets pollen (Seiteneffekte).
  useWebSocket();
  useWidgets();

  const state = useFridayStore((s) => s.state);
  const Screen = SCREENS[state];

  return (
    <>
      <AnimatePresence mode="wait">
        {/* `key` pro Zustand → AnimatePresence spielt Exit/Enter beim Wechsel. */}
        <Screen key={state} />
      </AnimatePresence>

      {/* Chat-Verlauf: einmal global gemountet (persistiert über Zustandswechsel),
          nur außerhalb von Idle sichtbar. */}
      <AnimatePresence>
        {state !== FridayState.IDLE && (
          <motion.div
            key="conversation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: '5vh',
              left: 0,
              right: 0,
              height: '48vh',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          >
            <ConversationView />
          </motion.div>
        )}
      </AnimatePresence>

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
