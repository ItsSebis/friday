/**
 * Domain: Die Zustandsmaschine von Friday (Frontend-Spiegel).
 *
 * Muss mit `backend/app/domain/states.py` synchron bleiben. Das Frontend
 * berechnet keine Übergänge selbst — es rendert den vom Backend empfangenen
 * Zustand. Die Werte sind exakt die Strings des Backend-Enums.
 */
export const FridayState = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
} as const;

export type FridayState = (typeof FridayState)[keyof typeof FridayState];

/** Type-Guard: prüft, ob ein beliebiger Wert ein gültiger FridayState ist. */
export function isFridayState(value: unknown): value is FridayState {
  return (
    typeof value === 'string' &&
    (Object.values(FridayState) as string[]).includes(value)
  );
}
