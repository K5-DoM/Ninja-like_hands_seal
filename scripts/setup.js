/**
 * Copies model artifacts into web/public/models/ for the Vite dev server.
 * Run once before `npm run dev`: npm run setup
 *
 * onnxruntime-web WASM files (.mjs + .wasm) are served directly from
 * node_modules via a custom Vite middleware — no copying needed.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODELS_SRC = join(__dirname, '../../artifacts/rgb_run_hand_009');
const MODELS_DST = join(__dirname, '../public/models');

mkdirSync(MODELS_DST, { recursive: true });

for (const f of ['model.onnx', 'idx_to_class.json']) {
  cpSync(join(MODELS_SRC, f), join(MODELS_DST, f));
  console.log(`[setup] copied models/${f}`);
}

const HAND_TASK_SRC = join(__dirname, '../../src/sealsrc/models/hand_landmarker.task');
cpSync(HAND_TASK_SRC, join(MODELS_DST, 'hand_landmarker.task'));
console.log('[setup] copied models/hand_landmarker.task');

const HANDSEAL_SRC = join(__dirname, '../../assets/handseal');
const HANDSEAL_DST = join(__dirname, '../public/assets/handseal');
mkdirSync(HANDSEAL_DST, { recursive: true });
for (const fname of [
  '01_nezumi.png','02_usi.png','03_tora.png','04_usagi.png',
  '05_tatsu.png','06_hebi.png','07_uma.png','08_hitsuzi.png',
  '09_saru.png','10_tori.png','11_inu.png','12_inoshishi.png',
]) {
  cpSync(join(HANDSEAL_SRC, fname), join(HANDSEAL_DST, fname));
}
console.log('[setup] copied 12 handseal thumbnails');

const X_ICON_SRC = join(__dirname, '../../assets/x_icon.webp');
const X_ICON_DST = join(__dirname, '../public/assets/x_icon.webp');
if (existsSync(X_ICON_SRC)) {
  cpSync(X_ICON_SRC, X_ICON_DST);
  console.log('[setup] copied x_icon.webp');
} else {
  console.warn('[setup] x_icon source not found, skipping');
}

const opt = spawnSync('node', [join(__dirname, 'optimize-images.js')], { stdio: 'inherit' });
if (opt.status !== 0) {
  console.error('[setup] optimize-images failed');
  process.exit(opt.status ?? 1);
}

const SFX_SRC = join(__dirname, '../../assets/sfx');
const SFX_DST = join(__dirname, '../public/assets/sfx');
mkdirSync(SFX_DST, { recursive: true });
for (const fname of [
  'seal_click.mp3', 'poof.mp3', 'fireball.mp3',
  'bunshins_attack.mp3', 'shuriken_attack.mp3', 'shuriken_defended.mp3',
  'failure.mp3',
]) {
  const src = join(SFX_SRC, fname);
  if (!existsSync(src)) {
    console.warn(`[setup] sfx source not found, skipping: ${fname}`);
    continue;
  }
  cpSync(src, join(SFX_DST, fname));
}
console.log('[setup] copied sfx files');

console.log('[setup] done — now run: npm run dev');
