/**
 * Presentation/Screen: ThinkingScreen.
 *
 * Übergangszustand, während der Agent verarbeitet (LLM/Tools). Zeigt eine
 * ruhige, rotierende Ring-Animation (rein CSS/transform → GPU) plus den
 * Verarbeitungsstatus und – falls aktiv – das Tool-Panel.
 */
import { motion } from 'framer-motion';
import { StatusIndicator } from '@presentation/components/StatusIndicator';
import { ToolPanel } from '@presentation/components/ToolPanel';
import { theme } from '@presentation/theme/theme';

export function ThinkingScreen() {
  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: theme.motion.base, ease: theme.motion.ease }}
      style={{ flexDirection: 'column', gap: 32, justifyContent: 'flex-end', paddingBottom: '8vh' }}
    >
      {/* Konzentrische, gegenläufig rotierende Ringe als „Denk“-Animation. */}
      <div style={{ position: 'relative', width: 220, height: 220 }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 6 - i * 1.5, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute',
              inset: i * 22,
              borderRadius: 'var(--radius-full)',
              border: '2px solid transparent',
              borderTopColor: theme.color.accent,
              borderRightColor: i === 1 ? theme.color.secondary : 'transparent',
              boxShadow: 'var(--glow-accent)',
            }}
          />
        ))}
      </div>

      <StatusIndicator label="Verarbeite" color={theme.color.secondary} pulse />

      <ToolPanel />
    </motion.div>
  );
}
