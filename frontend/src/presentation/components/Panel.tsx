/**
 * Presentation/Component: Panel.
 *
 * Transparentes, abgerundetes Glassmorphism-Panel – der visuelle Grundbaustein
 * für alle Overlays/Widgets. Animiert sanft ein/aus (Framer Motion).
 */
import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { theme } from '@presentation/theme/theme';

interface PanelProps {
  children: ReactNode;
  /** Voll runde Variante (z. B. für zentrale Kreis-Elemente). */
  round?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function Panel({ children, round = false, style, className }: PanelProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: theme.motion.base, ease: theme.motion.ease }}
      style={{
        background: 'var(--color-panel)',
        border: '1px solid var(--color-panel-border)',
        borderRadius: round ? 'var(--radius-full)' : 'var(--radius-lg)',
        boxShadow: 'var(--glow-panel)',
        backdropFilter: 'blur(var(--blur-panel))',
        WebkitBackdropFilter: 'blur(var(--blur-panel))',
        padding: round ? 0 : '24px',
        // GPU-Hint: eigenes Compositing-Layer für sanfte Animationen
        willChange: 'transform, opacity',
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}
