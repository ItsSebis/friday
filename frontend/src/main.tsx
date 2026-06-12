/**
 * Entry-Point der Kiosk-App.
 *
 * Hängt die React-Wurzel ein und umschließt sie mit dem ThemeProvider, der die
 * Design-Tokens als CSS-Variablen bereitstellt.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from '@presentation/theme/ThemeProvider';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root-Element #root nicht gefunden');

// Dev-Komfort: Store in der Browser-Konsole verfügbar machen
// (`window.fridayStore.getState()` / `.setState(...)`). Nur im Dev-Build.
if (import.meta.env.DEV) {
  import('@application/store/useFridayStore').then(({ useFridayStore }) => {
    (window as unknown as { fridayStore: typeof useFridayStore }).fridayStore = useFridayStore;
  });
}

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
