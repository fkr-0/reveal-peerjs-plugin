import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'dev';

  if (isDev) {
    // Dev mode: serve example with hot reload
    return {
      root: 'example',
      server: {
        port: 8080,
        open: true,
      },
      build: {
        outDir: '../example-dist',
        emptyOutDir: true,
      },
      plugins: [
        {
          name: 'copy-plugin',
          configureServer(server) {
            server.httpServer?.once('listening', () => {
              console.log('\n  Dev server running at http://localhost:8080');
              console.log('  Example slides with hot reload enabled!\n');
            });
          },
        },
      ],
    };
  }

  // Production build: library mode
  return {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'RevealPeerJS',
        formats: ['umd', 'es'],
        fileName: (format) => `reveal-peerjs.${format === 'es' ? 'es.js' : 'js'}`,
      },
      rollupOptions: {
        external: [],
        output: {
          globals: {},
          exports: 'default',
        },
      },
      outDir: 'dist',
      sourcemap: true,
      minify: 'esbuild',
    },
  };
});
