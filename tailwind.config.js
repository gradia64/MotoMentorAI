/** @type {import('tailwindcss').Config} */
// Tailwind compilato in build (prima era caricato via CDN a runtime:
// richiedeva rete, non era riproducibile e rompeva l'offline dell'app desktop).
export default {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
