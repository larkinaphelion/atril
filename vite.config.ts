import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' para que el build funcione dentro de Capacitor (file://) y en GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
});
