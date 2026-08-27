import { defineConfig } from 'vite';

// Minimal Vite config. Public assets (frames) are served from /public and
// copied to the build output as-is by Vite.
export default defineConfig({
  base: './',
  server: {
    host: true,
    // The live preview is served from a sandboxed proxy host, so accept any
    // dev host in this environment.
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
});
