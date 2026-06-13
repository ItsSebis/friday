/// <reference types="vite/client" />

/**
 * Typdeklaration der Friday-spezifischen Umgebungsvariablen (Vite).
 * Nur mit `VITE_`-Prefix deklarierte Variablen sind im Client verfügbar.
 */
interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  readonly VITE_PICOVOICE_ACCESS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
