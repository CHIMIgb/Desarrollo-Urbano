import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'API_']);
  const vitePort = parseInt(env.VITE_PORT);
  const apiPort = parseInt(env.API_PORT);

  return {
    root: '.',
    publicDir: 'public',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        external: ['maplibre-gl'],
        output: {
          globals: {
            'maplibre-gl': 'maplibregl',
          },
          manualChunks(id) {
            if (id.includes('node_modules/@turf')) return 'turf';
          },
        },
      },
    },
    server: {
      port: vitePort,
      proxy: {
        '/api': `http://localhost:${apiPort}`,
      },
    },
    css: {
      devSourcemap: true,
    },
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
  };
});
