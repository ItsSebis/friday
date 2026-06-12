/**
 * Presentation/Component: StatusIndicator.
 *
 * Kompakte, runde Statusanzeige mit pulsierendem Punkt und Label. Wird in den
 * Sprach-Screens genutzt, um den aktuellen Zustand klar zu kommunizieren.
 */
import { motion } from 'framer-motion';
import { theme } from '@presentation/theme/theme';

interface StatusIndicatorProps {
  label: string;
  /** Farbe des Pulspunkts (Default: Akzent). */
  color?: string;
  /** Pulsieren aktivieren (z. B. während Listening/Thinking). */
  pulse?: boolean;
}

export function StatusIndicator({
  label,
  color = theme.color.accent,
  pulse = true,
}: StatusIndicatorProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-panel)',
        border: '1px solid var(--color-panel-border)',
        backdropFilter: 'blur(var(--blur-panel))',
      }}
    >
      <motion.span
        animate={pulse ? { opacity: [0.4, 1, 0.4], scale: [0.85, 1.1, 0.85] } : {}}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 10,
          height: 10,
          borderRadius: 'var(--radius-full)',
          background: color,
          boxShadow: `0 0 12px ${color}`,
        }}
      />
      <span
        style={{
          fontSize: 14,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </span>
    </div>
  );
}
