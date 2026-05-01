import type { JutsuSpec } from "../pipeline/challenge.js";
import type { SealThumbMap } from "./assets.js";

// ─── Strip ───────────────────────────────────────────────────────────────────

export interface StripOptions {
  baseSize: number;
  nextSize: number;
  gapPx: number;
  paddingPx: number;
  bgFill: string;
  radius: number;
  ringColor: string;
  ringWidth: number;
  ringOuterRatio: number;
  pulsePeriodSec: number;
  pulseAmp: number;
}

export const DEFAULT_STRIP: StripOptions = {
  baseSize: 64, nextSize: 96, gapPx: 8, paddingPx: 12,
  bgFill: "rgba(0,0,0,0.55)", radius: 12,
  ringColor: "#AAFF5A", ringWidth: 5, ringOuterRatio: 0.92,
  pulsePeriodSec: 1.2, pulseAmp: 0.04,
};

export function drawTopStrip(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  topOffsetPx: number,
  spec: JutsuSpec,
  confirmedSteps: number,
  thumbs: SealThumbMap,
  nowSec: number,
  opt: StripOptions = DEFAULT_STRIP,
): void {
  const seq = spec.sequence;
  const n = seq.length;
  const nextIdx = confirmedSteps < n ? confirmedSteps : -1;

  const slotWidths = seq.map((_, i) => i === nextIdx ? opt.nextSize : opt.baseSize);
  const nativeStripWidth = slotWidths.reduce((a, b) => a + b, 0) + (n - 1) * opt.gapPx;
  const stripBoxWidth = nativeStripWidth + 2 * opt.paddingPx;
  const maxBoxWidth = cssWidth - 24;
  const scaleFit = stripBoxWidth > maxBoxWidth ? maxBoxWidth / stripBoxWidth : 1;

  const boxW = stripBoxWidth * scaleFit;
  const boxH = (opt.nextSize + 2 * opt.paddingPx) * scaleFit;
  const boxX = (cssWidth - boxW) / 2;
  const boxY = topOffsetPx;

  ctx.save();
  ctx.fillStyle = opt.bgFill;
  roundRect(ctx, boxX, boxY, boxW, boxH, opt.radius * scaleFit);
  ctx.fill();

  ctx.translate(boxX + opt.paddingPx * scaleFit, boxY + boxH / 2);
  ctx.scale(scaleFit, scaleFit);
  let cursorX = 0;

  for (let i = 0; i < n; i++) {
    const slotW = slotWidths[i];
    const isNext = i === nextIdx;
    const baseSize = isNext ? opt.nextSize : opt.baseSize;

    let drawSize = baseSize;
    if (isNext) {
      const phase = (2 * Math.PI * nowSec) / opt.pulsePeriodSec;
      const scale = 1 + opt.pulseAmp * Math.sin(phase);
      drawSize = baseSize * scale;
    }

    const cx = cursorX + slotW / 2;
    const cy = 0;
    const drawX = cx - drawSize / 2;
    const drawY = cy - drawSize / 2;

    const img = thumbs[seq[i]];
    if (img) {
      ctx.drawImage(img, drawX, drawY, drawSize, drawSize);
    }

    if (i < confirmedSteps) {
      const r = (baseSize * opt.ringOuterRatio) / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.lineWidth = opt.ringWidth;
      ctx.strokeStyle = opt.ringColor;
      ctx.stroke();
    }

    cursorX += slotW + opt.gapPx;
  }
  ctx.restore();
}

// ─── Endless HUD ─────────────────────────────────────────────────────────────

export interface EndlessHudOptions {
  iconSize: number;
  topOffsetRatio: number;
  pulsePeriodSec: number;
  pulseAmp: number;
  counterFont: string;
  counterColor: string;
  counterShadow: string;
  counterGapPx: number;
}

export const DEFAULT_ENDLESS: EndlessHudOptions = {
  iconSize: 160,
  topOffsetRatio: 0.06,
  pulsePeriodSec: 1.2,
  pulseAmp: 0.04,
  counterFont: "bold 56px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  counterColor: "#FFD45A",
  counterShadow: "rgba(255,212,90,0.6)",
  counterGapPx: 16,
};

export function drawEndlessHud(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  count: number,
  currentSeal: string,
  thumbs: SealThumbMap,
  nowSec: number,
  opt: EndlessHudOptions = DEFAULT_ENDLESS,
): void {
  const maxIcon = Math.min(opt.iconSize, cssWidth * 0.45);
  const phase = (2 * Math.PI * nowSec) / opt.pulsePeriodSec;
  const scale = 1 + opt.pulseAmp * Math.sin(phase);
  const drawSize = maxIcon * scale;

  const cx = cssWidth / 2;
  const cy = cssHeight * opt.topOffsetRatio + maxIcon / 2;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  const padding = 16;
  roundRect(ctx, cx - maxIcon / 2 - padding, cssHeight * opt.topOffsetRatio - padding,
            maxIcon + padding * 2, maxIcon + padding * 2, 16);
  ctx.fill();

  const img = thumbs[currentSeal];
  if (img) ctx.drawImage(img, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize);

  ctx.font = opt.counterFont;
  ctx.fillStyle = opt.counterColor;
  ctx.shadowColor = opt.counterShadow;
  ctx.shadowBlur = 16;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const counterY = cssHeight * opt.topOffsetRatio + maxIcon + opt.counterGapPx + padding;
  ctx.fillText(`× ${count}`, cx, counterY);
  ctx.restore();
}

// ─── Bottom bar ───────────────────────────────────────────────────────────────

export interface BottomBarOptions {
  bgFill: string;
  radius: number;
  widthRatio: number;
  bottomOffsetRatio: number;
  heightRatio: number;
  fontFamily: string;
  textColor: string;
  timerNormal: string;
  timerWarn: string;
  timerHeightPx: number;
  timerWarnThresholdSec: number;
}

export const DEFAULT_BOTTOM: BottomBarOptions = {
  bgFill: "rgba(0,0,0,0.63)", radius: 14,
  widthRatio: 0.7, bottomOffsetRatio: 0.06, heightRatio: 0.10,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans JP', sans-serif",
  textColor: "#fff",
  timerNormal: "#AAFF5A", timerWarn: "#FF4D4D",
  timerHeightPx: 4, timerWarnThresholdSec: 1.0,
};

export interface BottomBarRenderInput {
  text: string;
  remainingSec: number | null;
  perSealTimeoutSec: number;
  isWarning: boolean;
  blink: boolean;
}

export function drawBottomBar(
  ctx: CanvasRenderingContext2D,
  cssWidth: number, cssHeight: number,
  input: BottomBarRenderInput,
  opt: BottomBarOptions = DEFAULT_BOTTOM,
): void {
  const boxW = cssWidth * opt.widthRatio;
  const boxH = cssHeight * opt.heightRatio;
  const boxX = (cssWidth - boxW) / 2;
  const boxY = cssHeight - cssHeight * opt.bottomOffsetRatio - boxH;

  ctx.save();
  ctx.fillStyle = opt.bgFill;
  roundRect(ctx, boxX, boxY, boxW, boxH, opt.radius);
  ctx.fill();

  if (input.remainingSec !== null) {
    const ratio = Math.max(0, Math.min(1, input.remainingSec / input.perSealTimeoutSec));
    const timerW = boxW * ratio;
    ctx.fillStyle = opt.timerWarn;
    if (!input.isWarning) {
      ctx.fillStyle = opt.timerNormal;
    } else if (!input.blink) {
      ctx.globalAlpha = 0.4;
    }
    ctx.fillRect(boxX, boxY, timerW, opt.timerHeightPx);
    ctx.globalAlpha = 1.0;
  }

  const fontSize = Math.round(boxH * 0.40);
  ctx.fillStyle = opt.textColor;
  ctx.font = `bold ${fontSize}px ${opt.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let drawnSize = fontSize;
  let metrics = ctx.measureText(input.text);
  while (metrics.width > boxW * 0.92 && drawnSize > 12) {
    drawnSize -= 2;
    ctx.font = `bold ${drawnSize}px ${opt.fontFamily}`;
    metrics = ctx.measureText(input.text);
  }
  ctx.fillText(input.text, boxX + boxW / 2, boxY + boxH / 2 + opt.timerHeightPx / 2);
  ctx.restore();
}

// ─── Shared helper ───────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y,     x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x,     y + h, rr);
  ctx.arcTo(x,     y + h, x,     y,     rr);
  ctx.arcTo(x,     y,     x + w, y,     rr);
  ctx.closePath();
}
