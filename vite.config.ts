import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// NOTA 1 (sicurezza): la chiave Gemini NON viene piu' incorporata nel bundle.
// In ambiente desktop viene letta dal secret locale (~/.config/MotoMentorAI/gemini.key)
// tramite l'IPC del main process ed iniettata su window.GEMINI_API_KEY all'avvio.
// NOTA 2: base './' e' indispensabile per l'app Electron: il renderer viene caricato
// con loadFile() (protocollo file://) e asset con path assoluti non si risolverebbero.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
});
