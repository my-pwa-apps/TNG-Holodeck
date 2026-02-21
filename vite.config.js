import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  base: '/TNG-Holodeck/',   // GitHub Pages serves from this subdirectory
  plugins: [
    react(),
    glsl({ include: ['**/*.vert', '**/*.frag', '**/*.glsl'] }),
  ],
  server: {
    https: false, // WebXR requires HTTPS in production; use ngrok or similar for Quest testing
    host: true,
    port: 5173,
  },
  build: {
    outDir:  'docs',     // GitHub Pages serves /docs on the main branch
    target:  'esnext',
    sourcemap: true,
  },
});
