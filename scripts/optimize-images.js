import sharp from 'sharp';
import { mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../../assets/effects');
const DST = join(__dirname, '../public/assets/effects');

const FILES = [
  { name: 'chakra_burst',   q: 85 },
  { name: 'japanese_smoke', q: 85 },
  { name: 'bunshin',        q: 85 },
  { name: 'shuriken',       q: 90 },
  { name: 'bom_smoke',      q: 80 },
  { name: 'flog_magician',  q: 80 },
  { name: 'fire_ball',      q: 85 },
];

mkdirSync(DST, { recursive: true });

// Remove any stale PNG files left by previous setup runs
for (const { name } of FILES) {
  const stale = join(DST, `${name}.png`);
  if (existsSync(stale)) {
    rmSync(stale);
    console.log(`[opt] removed stale ${name}.png`);
  }
}

for (const { name, q } of FILES) {
  const src = join(SRC, `${name}.png`);
  const dst = join(DST, `${name}.webp`);

  if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) {
    console.log(`[opt] skip ${name} (up-to-date)`);
    continue;
  }

  const info = await sharp(src).webp({ quality: q }).toFile(dst);
  const kb = (info.size / 1024).toFixed(1);
  console.log(`[opt] ${name}.webp  ${kb} KB  q=${q}`);
}
