import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carica le variabili dai file .env locali
  const env = loadEnv(mode, '.', '');
  
  // FIX: Su Vercel (Produzione), le variabili d'ambiente sono in process.env.
  // loadEnv non le legge automaticamente se non sono in un file fisico.
  // Usiamo un fallback per garantire che la chiave venga letta correttamente sia in locale che in cloud.
  // UPDATE: Aggiunto supporto esplicito per GEMINI_API_KEY come nome alternativo.
  const apiKey = env.API_KEY || process.env.API_KEY || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  return {
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
      'global': 'window',
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 2000,
    }
  };
});