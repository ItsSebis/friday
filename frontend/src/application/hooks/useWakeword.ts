/**
 * Application: Wakeword-Erkennung (Picovoice Porcupine, im Browser).
 *
 * Lauscht im Idle-Zustand dauerhaft auf das Weckwort (built-in **„Jarvis"**,
 * passend zum FRIDAY-Thema) und ruft bei Erkennung `onWake()` — was die Aufnahme
 * startet. Läuft komplett offline auf dem Gerät.
 *
 * Koordination mit der Aufnahme: Während Friday zuhört/verarbeitet/spricht, wird
 * der Detektor pausiert (sonst Mikrofon-Konflikt und Selbst-Auslösung). Ohne
 * `VITE_PICOVOICE_ACCESS_KEY` bleibt das Wakeword aus — Push-to-talk funktioniert
 * dann weiterhin.
 *
 * Voraussetzungen (siehe README): AccessKey (console.picovoice.ai) und die Datei
 * `public/porcupine_params.pv`.
 */
import { useEffect, useRef } from 'react';
import { usePorcupine } from '@picovoice/porcupine-react';
import { BuiltInKeyword } from '@picovoice/porcupine-web';
import { useFridayStore } from '@application/store/useFridayStore';
import { FridayState } from '@domain/states';

const ACCESS_KEY = import.meta.env.VITE_PICOVOICE_ACCESS_KEY;

export function useWakeword(onWake: () => void) {
  const { keywordDetection, isLoaded, init, start, stop, release, error } = usePorcupine();
  const state = useFridayStore((s) => s.state);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  // Einmalig initialisieren – nur, wenn ein AccessKey konfiguriert ist.
  useEffect(() => {
    if (!ACCESS_KEY) return;
    void init(
      ACCESS_KEY,
      { builtin: BuiltInKeyword.Jarvis },
      { publicPath: '/porcupine_params.pv' },
    ).catch((e) => console.error('Wakeword-Init fehlgeschlagen:', e));
    return () => {
      void release();
    };
  }, [init, release]);

  // Bei Erkennung im Idle-Zustand die Aufnahme auslösen.
  useEffect(() => {
    if (keywordDetection !== null && useFridayStore.getState().state === FridayState.IDLE) {
      onWakeRef.current();
    }
  }, [keywordDetection]);

  // Detektor nur im Idle laufen lassen (Mikrofon-Konflikt vermeiden).
  useEffect(() => {
    if (!isLoaded) return;
    if (state === FridayState.IDLE) void start();
    else void stop();
  }, [isLoaded, state, start, stop]);

  useEffect(() => {
    if (error) console.error('Wakeword-Fehler:', error);
  }, [error]);
}
