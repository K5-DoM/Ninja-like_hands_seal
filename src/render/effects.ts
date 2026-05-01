import type { EffectSprites } from "./effect-assets.js";
import { EFFECTS, EFFECT_DURATION } from "./effects-anim.js";

export class EffectsRenderer {
  private rafId: number | null = null;
  private dpr = 1;
  private current: { id: string; startSec: number } | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly sprites: EffectSprites,
  ) {
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

  play(id: string, nowSec: number): void {
    if (!(id in EFFECTS)) return;
    this.current = { id, startSec: nowSec };
  }

  stop(): void {
    this.current = null;
  }

  start(): void {
    if (this.rafId !== null) return;
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.draw();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener("resize", this.handleResize);
  }

  private draw(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (!this.current) return;

    const t = performance.now() / 1000 - this.current.startSec;
    const dur = EFFECT_DURATION[this.current.id] ?? 2.0;
    if (t < 0 || t > dur) {
      this.current = null;
      return;
    }

    const fn = EFFECTS[this.current.id];
    if (!fn) { this.current = null; return; }
    fn(ctx, t, cssW, cssH, this.sprites);
  }
}
