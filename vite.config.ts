import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fix: Use '.' instead of process.cwd() to avoid TS error 'Property cwd does not exist on type Process'
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Polyfill per process.env.API_KEY nel browser per mantenere compatibilità col codice esistente
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill generico per evitare crash su altre chiamate process.env
      'process.env': {}
    },
    build: {
      outDir: 'dist',
    }
  };
});