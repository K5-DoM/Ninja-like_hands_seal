/**
 * Copies onnxruntime-web and @mediapipe/tasks-vision wasm files
 * from node_modules into public/ so they're picked up by the Vite build.
 *
 * Models, images, and sound effects are committed directly under public/
 * in this standalone repository, so we only handle wasm here.
 *
 * Run automatically as `prebuild` (see package.json).
 */
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ORT_SRC = join(ROOT, 'node_modules/onnxruntime-web/dist');
const ORT_DST = join(ROOT, 'public/ort');
const MP_SRC = join(ROOT, 'node_modules/@mediapipe/tasks-vision/wasm');
const MP_DST = join(ROOT, 'public/assets/mp-vision-wasm');

mkdirSync(ORT_DST, { recursive: true });
for (const f of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  cpSync(join(ORT_SRC, f), join(ORT_DST, f));
}
console.log('[setup] copied onnxruntime-web wasm files -> public/ort/');

mkdirSync(MP_DST, { recursive: true });
cpSync(MP_SRC, MP_DST, { recursive: true });
console.log('[setup] copied MediaPipe vision wasm files -> public/assets/mp-vision-wasm/');
