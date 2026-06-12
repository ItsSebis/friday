/**
 * Presentation: Zentrale Design-Tokens.
 *
 * Einzige Quelle der Wahrheit für Farben, Radien, Glow und Animationszeiten.
 * - Für CSS werden die Tokens vom `ThemeProvider` als CSS-Variablen auf
 *   `:root` gesetzt (z. B. `var(--color-accent)`).
 * - Für JS-Consumer (Three.js, Framer Motion) wird das Objekt direkt importiert.
 *
 * Designsprache: dunkel, futuristisch, Iron-Man-FRIDAY-inspiriert.
 */
export const theme = {
  color: {
    /** Tiefes Blau-Schwarz als Hintergrund. */
    background: '#04070d',
    backgroundElevated: '#0a1018',
    /** FRIDAY-Akzent: cyan-blaues Glühen. */
    accent: '#36d6ff',
    accentSoft: '#1b7da6',
    /** Warmer Sekundärakzent (Iron-Man-Gold) für Highlights. */
    secondary: '#ffb347',
    text: '#e8f4ff',
    textMuted: '#7d93a8',
    danger: '#ff5470',
    /** Halbtransparente Panel-Füllung (Glassmorphism). */
    panel: 'rgba(18, 30, 44, 0.45)',
    panelBorder: 'rgba(54, 214, 255, 0.18)',
  },
  radius: {
    sm: '8px',
    md: '16px',
    lg: '28px',
    pill: '999px',
    /** Voll rund – für kreisförmige Elemente. */
    full: '50%',
  },
  glow: {
    accent: '0 0 24px rgba(54, 214, 255, 0.45)',
    accentStrong: '0 0 48px rgba(54, 214, 255, 0.65)',
    panel: '0 8px 40px rgba(0, 0, 0, 0.55)',
  },
  blur: {
    panel: '14px',
  },
  font: {
    family: "'Inter', 'Segoe UI', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', monospace",
  },
  motion: {
    /** Sanfte Standard-Übergänge (GPU-freundlich). */
    fast: 0.2,
    base: 0.4,
    slow: 0.8,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
} as const;

export type Theme = typeof theme;

/**
 * Flacht die Theme-Tokens zu CSS-Variablen ab (`--color-accent`, `--radius-md`,
 * `--glow-panel`, …). Wird vom ThemeProvider auf `:root` geschrieben.
 */
export function themeToCssVars(t: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(t.color)) vars[`--color-${kebab(key)}`] = value;
  for (const [key, value] of Object.entries(t.radius)) vars[`--radius-${kebab(key)}`] = value;
  for (const [key, value] of Object.entries(t.glow)) vars[`--glow-${kebab(key)}`] = value;
  for (const [key, value] of Object.entries(t.blur)) vars[`--blur-${kebab(key)}`] = value;
  vars['--font-family'] = t.font.family;
  vars['--font-mono'] = t.font.mono;
  return vars;
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
