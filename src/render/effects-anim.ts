import type { EffectSprites } from "./effect-assets.js";

export type EffectFn = (
  ctx: CanvasRenderingContext2D,
  t: number,
  W: number,
  H: number,
  sprites: EffectSprites,
) => void;

export const EFFECT_DURATION: Readonly<Record<string, number>> = {
  bunshin:        2.0,
  kage_shuriken:  1.8,
  kuchiyose:      2.5,
  gokakyu:        2.2,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function drawSpriteCentered(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number, cy: number,
  width: number,
  alpha: number,
): void {
  if (alpha <= 0 || width <= 0) return;
  const h = (img.height / Math.max(1, img.width)) * width;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(img, cx - width / 2, cy - h / 2, width, h);
  ctx.globalAlpha = 1;
}

function drawShurikenAt(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number, cy: number,
  size: number,
  rotDeg: number,
  alpha: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawChakraBurst(
  ctx: CanvasRenderingContext2D,
  t: number, W: number, H: number,
  sprite: HTMLImageElement,
  cx: number = W / 2,
  cy: number = H / 2,
): void {
  if (t > 0.3) return;
  const baseW = Math.min(W, H) * 0.6;
  const scale = lerp(0.2, 1.4, t / 0.3);
  const alpha = lerp(1.0, 0.0, t / 0.3);
  drawSpriteCentered(ctx, sprite, cx, cy, baseW * scale, alpha);
}

// ─── Lv1: 分身の術 ───────────────────────────────────────────────────────────

export function drawBunshin(
  ctx: CanvasRenderingContext2D, t: number, W: number, H: number, sp: EffectSprites,
): void {
  drawChakraBurst(ctx, t, W, H, sp.chakra_burst);

  if (t >= 0.2 && t <= 0.8) {
    const p = (t - 0.2) / 0.6;
    const scale = lerp(0.6, 1.0, p);
    const alpha = lerp(0.0, 0.85, p);
    const baseW = Math.min(W, H) * 0.9;
    drawSpriteCentered(ctx, sp.japanese_smoke, W / 2, H / 2, baseW * scale, alpha);
  }

  if (t >= 0.6 && t <= 1.5) {
    const COUNT = 8;
    const p = (t - 0.6) / 0.9;
    const w = W * 0.4;
    const h = (sp.bunshin.height / Math.max(1, sp.bunshin.width)) * w;
    const alpha = lerp(0.0, 1.0, p);
    ctx.globalAlpha = alpha;
    for (let k = 0; k < COUNT; k++) {
      const cx = W * (k + 0.5) / COUNT;
      const yTop = lerp(H, H / 2 + (k % 2 === 0 ? 0 : H * 0.05), p);
      ctx.drawImage(sp.bunshin, cx - w / 2, yTop, w, h);
    }
    ctx.globalAlpha = 1;
  }

  if (t >= 1.3 && t <= 2.0) {
    const p = (t - 1.3) / 0.7;
    const a = (1 - lerp(1.0, 0.0, p)) * (200 / 255);
    ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ─── Lv2: 手裏剣影分身の術 ───────────────────────────────────────────────────

export function drawKageShuriken(
  ctx: CanvasRenderingContext2D, t: number, W: number, H: number, sp: EffectSprites,
): void {
  drawChakraBurst(ctx, t, W, H, sp.chakra_burst);

  const phases: [number, number, number][] = [
    [0.3, 0.5,  2],
    [0.5, 0.8,  4],
    [0.8, 1.1,  8],
    [1.1, 1.4, 16],
  ];
  const size = Math.max(16, W * 0.08);

  for (const [start, end, count] of phases) {
    if (t < start || t > end) continue;
    const prog = (t - start) / (end - start);
    const alpha = lerp(0.7, 1.0, prog);
    const dist = lerp(0, W * 0.35, prog);
    const rng = mulberry32(42);
    for (let k = 0; k < count; k++) {
      const baseAngle = 360 * k / count + t * 180;
      const jitter = (rng() * 2 - 1) * 15;
      const angle = baseAngle + jitter;
      const rx = W / 2 + dist * Math.cos((angle * Math.PI) / 180);
      const ry = H / 2 + dist * Math.sin((angle * Math.PI) / 180);
      drawShurikenAt(ctx, sp.shuriken, rx, ry, size, baseAngle * 3, alpha);
    }
  }

  if (t > 1.4 && t <= 1.8) {
    const fade = lerp(1.0, 0.0, (t - 1.4) / 0.4);
    const dist = lerp(W * 0.35, W * 0.7, (t - 1.4) / 0.4);
    for (let k = 0; k < 16; k++) {
      const angle = 360 * k / 16;
      const rx = W / 2 + dist * Math.cos((angle * Math.PI) / 180);
      const ry = H / 2 + dist * Math.sin((angle * Math.PI) / 180);
      drawShurikenAt(ctx, sp.shuriken, rx, ry, size, angle * 5, fade);
    }
  }
}

// ─── Lv3: 口寄せの術 ─────────────────────────────────────────────────────────

export function drawKuchiyose(
  ctx: CanvasRenderingContext2D, t: number, W: number, H: number, sp: EffectSprites,
): void {
  drawChakraBurst(ctx, t, W, H, sp.chakra_burst);

  if (t >= 0.3 && t <= 1.0) {
    const prog = (t - 0.3) / 0.7;
    const scale = lerp(0.5, 1.2, prog);
    const alpha = lerp(0.0, 0.9, prog);
    const sw = W * scale;
    const sh = (sp.bom_smoke.height / Math.max(1, sp.bom_smoke.width)) * sw;
    const yPos = H - sh * lerp(0.3, 0.7, prog);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.bom_smoke, (W - sw) / 2, yPos, sw, sh);
    ctx.globalAlpha = 1;
  }

  if (t >= 0.8 && t <= 2.0) {
    const prog = (t - 0.8) / 1.2;
    const fw = W * 0.6;
    const fh = (sp.flog_magician.height / Math.max(1, sp.flog_magician.width)) * fw;
    const yPos = lerp(H, H / 2 - fh / 2, prog);
    const alpha = lerp(0.0, 1.0, Math.min(prog * 2, 1.0));
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.flog_magician, (W - fw) / 2, yPos, fw, fh);
    ctx.globalAlpha = 1;
  }

  if (t >= 2.0 && t <= 2.5) {
    const p = (t - 2.0) / 0.5;
    const a = (1 - lerp(1.0, 0.0, p)) * (230 / 255);
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ─── Lv4: 火遁・豪火球の術 ───────────────────────────────────────────────────

export function drawGokakyu(
  ctx: CanvasRenderingContext2D, t: number, W: number, H: number, sp: EffectSprites,
): void {
  // chakra burst at mouth height (y = 0.55 * H)
  drawChakraBurst(ctx, t, W, H, sp.chakra_burst, W / 2, H * 0.55);

  if (t >= 0.3 && t <= 0.6) {
    const prog = (t - 0.3) / 0.3;
    const fw = W * lerp(0.1, 0.3, prog);
    const alpha = lerp(0.0, 1.0, prog);
    drawSpriteCentered(ctx, sp.fire_ball, W / 2, H * 0.55, fw, alpha);
  }

  if (t >= 0.6 && t <= 1.6) {
    const prog = (t - 0.6) / 1.0;
    const fw = W * lerp(0.3, 0.9, prog);
    // left edge: lerp(W/2 - fw/2, W - fw/4); center: left + fw/2
    const leftEdge = lerp(W / 2 - fw / 2, W - fw / 4, prog);
    const cx = leftEdge + fw / 2;
    drawSpriteCentered(ctx, sp.fire_ball, cx, H * 0.55, fw, 1.0);
  }

  if (t >= 1.6 && t <= 2.2) {
    const fade = lerp(1.0, 0.0, (t - 1.6) / 0.6);
    const fw = W * 0.9;
    const cx = (W - fw / 4) + fw / 2;  // left edge = W - fw/4; center = left + fw/2
    drawSpriteCentered(ctx, sp.fire_ball, cx, H * 0.55, fw, fade);
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const EFFECTS: Readonly<Record<string, EffectFn>> = {
  bunshin:       drawBunshin,
  kage_shuriken: drawKageShuriken,
  kuchiyose:     drawKuchiyose,
  gokakyu:       drawGokakyu,
};
