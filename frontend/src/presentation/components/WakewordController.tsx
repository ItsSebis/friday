/**
 * Presentation/Component: WakewordController.
 *
 * Dünne Hülle um `useWakeword`. Wird **lazy** geladen und nur gemountet, wenn ein
 * Picovoice-AccessKey gesetzt ist — so landet das (große) Porcupine-WASM nur dann
 * im Bundle/Speicher, wenn das Wakeword wirklich genutzt wird. Rendert nichts.
 */
import { useWakeword } from '@application/hooks/useWakeword';

export function WakewordController({ onWake }: { onWake: () => void }) {
  useWakeword(onWake);
  return null;
}
