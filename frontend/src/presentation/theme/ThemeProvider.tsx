/**
 * Presentation: ThemeProvider.
 *
 * Schreibt die Design-Tokens einmalig als CSS-Variablen auf `:root`, sodass
 * alle Stylesheets über `var(--…)` darauf zugreifen. Hält JS- und CSS-Welt
 * konsistent (eine Quelle: `theme.ts`).
 */
import { useLayoutEffect, type ReactNode } from 'react';
import { theme, themeToCssVars } from './theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = themeToCssVars(theme);
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
  }, []);

  return <>{children}</>;
}
