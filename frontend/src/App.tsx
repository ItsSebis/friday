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
import { AnimatePresence } from 'framer-motion';
import { useWebSocket } from '@application/hooks/useWebSocket';
import { useFridayStore } from '@application/store/useFridayStore';
import { FridayState } from '@domain/states';
import { IdleScreen } from '@presentation/screens/IdleScreen';
import { ListeningScreen } from '@presentation/screens/ListeningScreen';
import { ThinkingScreen } from '@presentation/screens/ThinkingScreen';
import { SpeakingScreen } from '@presentation/screens/SpeakingScreen';

/** Mapt jeden Zustand auf seinen Screen (erschöpfend). */
const SCREENS: Record<FridayState, () => JSX.Element> = {
  [FridayState.IDLE]: IdleScreen,
  [FridayState.LISTENING]: ListeningScreen,
  [FridayState.THINKING]: ThinkingScreen,
  [FridayState.SPEAKING]: SpeakingScreen,
};

export function App() {
  // Verbindung aufbauen (Seiteneffekt; Rückgabe hier nicht benötigt).
  useWebSocket();

  const state = useFridayStore((s) => s.state);
  const Screen = SCREENS[state];

  return (
    <AnimatePresence mode="wait">
      {/* `key` pro Zustand → AnimatePresence spielt Exit/Enter beim Wechsel. */}
      <Screen key={state} />
    </AnimatePresence>
  );
}
