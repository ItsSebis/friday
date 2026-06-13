/**
 * Presentation/Component: StatusOrb.
 *
 * Kompakter Zustands-Indikator in der Ecke — ersetzt die früheren
 * Vollbild-Screens pro Zustand. Zeigt mit Farbe + Label, ob Friday gerade
 * bereit ist, zuhört, verarbeitet oder spricht; bei Listening/Speaking pulsiert
 * der Ring zusätzlich mit dem echten Audiopegel.
 */
import { motion } from 'framer-motion';
import { useFridayStore } from '@application/store/useFridayStore';
import { FridayState } from '@domain/states';
import { theme } from '@presentation/theme/theme';

const META: Record<FridayState, { color: string; label: string }> = {
  [FridayState.IDLE]: { color: theme.color.textMuted, label: 'Bereit' },
  [FridayState.LISTENING]: { color: theme.color.accent, label: 'Höre zu' },
  [FridayState.THINKING]: { color: theme.color.secondary, label: 'Denkt nach' },
  [FridayState.SPEAKING]: { color: theme.color.accent, label: 'Spricht' },
};

export function StatusOrb() {
  const state = useFridayStore((s) => s.state);
  const level = useFridayStore((s) => s.audioLevel);
  const meta = META[state];

  const reactive = state === FridayState.LISTENING || state === FridayState.SPEAKING;
  const thinking = state === FridayState.THINKING;

  return (
    <div
      style={{
        position: 'fixed',
        top: 22,
        right: 26,
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative', width: 34, height: 34 }}>
        {/* Pulsierender Ring – skaliert mit dem Audiopegel. */}
        <motion.div
          animate={{
            scale: reactive ? 1 + level * 0.9 : thinking ? 1 : 0.85,
            opacity: reactive ? 0.35 + level * 0.5 : 0.3,
          }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--radius-full)',
            border: `2px solid ${meta.color}`,
            boxShadow: `0 0 16px ${meta.color}`,
          }}
        />

        {/* Thinking: rotierender Bogen. */}
        {thinking && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute',
              inset: 4,
              borderRadius: 'var(--radius-full)',
              border: '2px solid transparent',
              borderTopColor: meta.color,
              borderRightColor: meta.color,
            }}
          />
        )}

        {/* Kern-Punkt. */}
        <div
          style={{
            position: 'absolute',
            inset: '38%',
            borderRadius: 'var(--radius-full)',
            background: meta.color,
            boxShadow: `0 0 10px ${meta.color}`,
          }}
        />
      </div>

      <span
        style={{
          font: `12px ${theme.font.family}`,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: meta.color,
          textShadow: `0 0 12px ${meta.color}55`,
        }}
      >
        {meta.label}
      </span>
    </div>
  );
}
