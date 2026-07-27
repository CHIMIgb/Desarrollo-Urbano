import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'API_', '']);
  const vitePort = parseInt(env.VITE_PORT) || 3000;
  const apiPort = parseInt(env.API_PORT || env.PORT) || 3001;

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
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
        '/osm-proxy': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
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
