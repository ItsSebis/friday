/**
 * Presentation/Component: TalkOverlay (Push-to-talk-Steuerung).
 *
 * Mountet die Voice-Bridge (`useVoice`) genau einmal und stellt den
 * Sprach-Trigger bereit:
 *  - **Tippen/Klick** irgendwo auf den Bildschirm togglet die Aufnahme
 *    (Touchscreen-freundlich für den Kiosk).
 *  - **Leertaste** als Tastatur-Alternative (Dev/Debug).
 *
 * Im Idle-Zustand zeigt es einen dezenten Hinweis. Wakeword-Erkennung kann
 * später hier andocken (statt manuellem Tippen).
 */
import { lazy, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useVoice } from '@application/hooks/useVoice';
import { useFridayStore } from '@application/store/useFridayStore';
import { FridayState } from '@domain/states';
import { theme } from '@presentation/theme/theme';

// Wakeword nur laden, wenn ein AccessKey gesetzt ist → Porcupine-WASM (groß)
// wird sonst gar nicht ins Bundle gezogen.
const WAKEWORD_ENABLED = Boolean(import.meta.env.VITE_PICOVOICE_ACCESS_KEY);
const WakewordController = WAKEWORD_ENABLED
  ? lazy(() =>
      import('@presentation/components/WakewordController').then((m) => ({
        default: m.WakewordController,
      })),
    )
  : null;

export function TalkOverlay() {
  const { startListening, toggleListening } = useVoice();
  const state = useFridayStore((s) => s.state);

  // Leertaste als Trigger (ignoriert, wenn ein Eingabefeld fokussiert ist).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        toggleListening();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleListening]);

  return (
    <>
      {/* Wakeword-Erkennung (nur mit AccessKey, lazy geladen). */}
      {WakewordController && (
        <Suspense fallback={null}>
          <WakewordController onWake={startListening} />
        </Suspense>
      )}

      {/* Transparente Tap-Fläche unter den Inhalten, aber klickbar. */}
      <div
        onPointerDown={toggleListening}
        style={{ position: 'fixed', inset: 0, zIndex: 1, background: 'transparent' }}
      />

      {/* Dezenter Hinweis nur im Idle-Zustand. */}
      {state === FridayState.IDLE && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          style={{
            position: 'fixed',
            bottom: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            font: `12px ${theme.font.family}`,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: theme.color.textMuted,
            pointerEvents: 'none',
          }}
        >
          „Jarvis" sagen oder tippen
        </motion.div>
      )}
    </>
  );
}
