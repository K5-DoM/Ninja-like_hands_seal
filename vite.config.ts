import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import { createReadStream, stat } from 'fs';

const ORT_DIST = resolve(__dirname, 'node_modules/onnxruntime-web/dist');
const MP_VISION_WASM = resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm');

const MIME: Record<string, string> = {
  wasm: 'application/wasm',
  mjs:  'text/javascript; charset=utf-8',
  js:   'text/javascript; charset=utf-8',
};

export default defineConfig({
  resolve: {
    alias: {
      // WASM-only bundle: avoids JSEP (WebGPU) dynamic import that breaks Vite
      'onnxruntime-web': resolve(ORT_DIST, 'ort.wasm.min.mjs'),
    },
  },

  plugins: [
    {
      // @mediapipe/tasks-vision references a .map file that doesn't exist in the package.
      // Strip the sourceMappingURL comment to silence the browser warning.
      name: 'strip-mediapipe-sourcemap',
      transform(code, id) {
        if (id.includes('@mediapipe/tasks-vision')) {
          return { code: code.replace(/\/\/# sourceMappingURL=\S+/g, ''), map: null };
        }
      },
    },
    {
      name: 'serve-ort-wasm',
      // Runs BEFORE Vite's own middleware, so the public-dir check is bypassed.
      configureServer(server) {
        server.middlewares.use('/assets/mp-vision-wasm', (req, res, next) => {
          const filename = (req.url ?? '/').slice(1).split('?')[0];
          if (!filename) return next();
          const filePath = join(MP_VISION_WASM, filename);
          const ext = filename.split('.').pop() ?? '';
          const contentType = MIME[ext] ?? 'application/octet-stream';
          stat(filePath, (err) => {
            if (err) return next();
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
            createReadStream(filePath).pipe(res);
          });
        });
        server.middlewares.use('/assets/wasm', (req, res, next) => {
          // req.url has the prefix stripped, e.g. '/ort-wasm-simd-threaded.mjs'
          const filename = (req.url ?? '/').slice(1).split('?')[0];
          if (!filename) return next();

          const filePath = join(ORT_DIST, filename);
          const ext = filename.split('.').pop() ?? '';
          const contentType = MIME[ext] ?? 'application/octet-stream';

          stat(filePath, (err) => {
            if (err) return next();
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
            createReadStream(filePath).pipe(res);
          });
        });
      },
    },
  ],

  server: {
    allowedHosts: ['.trycloudflare.com'],
    // COOP/COEP required for SharedArrayBuffer → multi-thread WASM
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },

  optimizeDeps: {
    exclude: ['onnxruntime-web', '@mediapipe/tasks-vision'],
  },
});
