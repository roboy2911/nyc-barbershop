import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH is set when building for GitHub Pages (site lives at /nyc-barbershop/).
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
});
