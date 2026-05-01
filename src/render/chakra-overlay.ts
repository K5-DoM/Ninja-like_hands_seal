import type { Box } from "../pipeline/hand.js";

export interface ChakraOverlayOptions {
  angularDegPerSec?: number;
  fadeMs?: number;
  blendMode?: GlobalCompositeOperation;
  diameterScale?: number;
  alphaBase?: number;
  pulseAmp?: number;
  pulseHz?: number;
}

export class ChakraOverlay {
  private box: Box | null = null;
  private active = false;
  private lastToggleAt = 0;
  private rafId: number | null = null;
  private dpr = 1;

  private readonly angularRadPerSec: number;
  private readonly fadeMs: number;
  private readonly blendMode: GlobalCompositeOperation;
  private readonly diameterScale: number;
  private readonly alphaBase: number;
  private readonly pulseAmp: number;
  private readonly pulseHz: number;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly video: HTMLVideoElement,
    private readonly sprite: HTMLImageElement,
    opts: ChakraOverlayOptions = {},
  ) {
    this.angularRadPerSec = ((opts.angularDegPerSec ?? 45) * Math.PI) / 180;
    this.fadeMs = opts.fadeMs ?? 180;
    this.blendMode = opts.blendMode ?? "lighter";
    this.diameterScale = opts.diameterScale ?? 1.0;
    this.alphaBase = opts.alphaBase ?? 0.80;
    this.pulseAmp = opts.pulseAmp ?? 0.10;
    this.pulseHz = opts.pulseHz ?? 0.8;

    this.handleResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResize);
    this.handleResize();
  }

  private handleResize(): void {
    this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  setBox(box: Box | null): void {
    this.box = box;
  }

  setActive(active: boolean): void {
    if (active !== this.active) {
      this.active = active;
      this.lastToggleAt = performance.now();
    }
  }

  start(): void {
    if (this.rafId !== null) return;
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.draw();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    const ctx = this.canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
  }

  private draw(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (this.box === null) return;

    const nowMs = performance.now();
    const msSinceToggle = nowMs - this.lastToggleAt;
    const fadeFactor = this.active
      ? Math.min(1, msSinceToggle / this.fadeMs)
      : Math.max(0, 1 - msSinceToggle / this.fadeMs);

    if (fadeFactor <= 0) return;

    const [x0, y0, x1, y1] = this.box;
    const videoW = this.video.videoWidth;
    const videoH = this.video.videoHeight;
    if (videoW === 0 || videoH === 0) return;

    // object-fit: cover mapping
    const scale = Math.max(cssW / videoW, cssH / videoH);
    const dispW = videoW * scale;
    const dispH = videoH * scale;
    const offsetX = (cssW - dispW) / 2;
    const offsetY = (cssH - dispH) / 2;

    const cxV = (x0 + x1) / 2;
    const cyV = (y0 + y1) / 2;
    const sideV = Math.max(x1 - x0, y1 - y0);

    const sx = offsetX + cxV * scale;
    const sy = offsetY + cyV * scale;
    const diameter = sideV * scale * this.diameterScale;

    // mirror: video is scaleX(-1) in CSS
    const sxMirrored = cssW - sx;

    const nowSec = nowMs / 1000;
    const angle = (nowSec * this.angularRadPerSec) % (2 * Math.PI);
    const pulse = 1 + this.pulseAmp * Math.sin(2 * Math.PI * this.pulseHz * nowSec);
    const alpha = this.alphaBase * fadeFactor * pulse;

    const sw = this.sprite.naturalWidth || this.sprite.width;
    const sh = this.sprite.naturalHeight || this.sprite.height;
    if (sw === 0 || sh === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = this.blendMode;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(sxMirrored, sy);
    ctx.rotate(angle);
    ctx.drawImage(this.sprite, -diameter / 2, -diameter / 2, diameter, diameter);
    ctx.restore();
  }
}
