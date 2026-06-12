import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite-Konfiguration für das Friday-Kiosk-Frontend.
 *
 * - Pfad-Aliase spiegeln die Clean-Architecture-Schichten (siehe ARCHITECTURE.md).
 * - Der Dev-Server lauscht auf allen Interfaces (`host: true`), damit der
 *   Raspberry-Pi-Kiosk-Browser im LAN zugreifen kann.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
      '@application': fileURLToPath(new URL('./src/application', import.meta.url)),
      '@infrastructure': fileURLToPath(new URL('./src/infrastructure', import.meta.url)),
      '@presentation': fileURLToPath(new URL('./src/presentation', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
