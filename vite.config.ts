import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carica le variabili dai file .env locali
  const env = loadEnv(mode, '.', '');
  
  // FIX: Su Vercel (Produzione), le variabili d'ambiente sono in process.env.
  // loadEnv non le legge automaticamente se non sono in un file fisico.
  // Usiamo un fallback per garantire che la chiave venga letta correttamente sia in locale che in cloud.
  const apiKey = env.API_KEY || process.env.API_KEY;

  return {
    plugins: [react()],
    define: {
      // Inietta il valore della chiave API nel codice frontend sostituendo la stringa 'process.env.API_KEY'
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Definisce process.env come oggetto vuoto per evitare crash di librerie terze che lo richiedono,
      // ma senza sovrascrivere la definizione specifica di API_KEY sopra.
      'process.env': {}
    },
    build: {
      outDir: 'dist',
    }
  };
});