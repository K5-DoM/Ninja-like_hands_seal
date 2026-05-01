export class DebugHud {
  private el: HTMLDivElement;
  private frames = 0;
  private lastFpsAt = performance.now();
  private fps = 0;
  private inferMs = 0;
  private inferCount = 0;
  private inferSum = 0;
  private inferEffectiveFps = 0;
  private lastInferAt = 0;
  private rafId: number | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.id = "debug-hud";
    Object.assign(this.el.style, {
      position: "fixed", right: "8px", bottom: "8px", zIndex: "5",
      padding: "6px 10px", borderRadius: "6px",
      background: "rgba(0,0,0,0.7)", color: "#0f0",
      font: "11px/1.4 ui-monospace, monospace",
      pointerEvents: "none", whiteSpace: "pre",
    });
    document.body.appendChild(this.el);
  }

  start(): void {
    if (this.rafId !== null) return;
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.frames++;
      const now = performance.now();
      if (now - this.lastFpsAt >= 1000) {
        this.fps = this.frames * 1000 / (now - this.lastFpsAt);
        this.frames = 0;
        this.lastFpsAt = now;
        this.render();
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  recordInfer(ms: number): void {
    this.inferSum += ms;
    this.inferCount++;
    const now = performance.now();
    if (this.lastInferAt > 0) {
      this.inferEffectiveFps = 1000 / (now - this.lastInferAt);
    }
    this.lastInferAt = now;
    if (this.inferCount >= 10) {
      this.inferMs = this.inferSum / this.inferCount;
      this.inferSum = 0;
      this.inferCount = 0;
    }
  }

  private render(): void {
    this.el.textContent =
      `FPS:    ${this.fps.toFixed(1)}\n` +
      `Infer:  ${this.inferMs.toFixed(0)} ms (${this.inferEffectiveFps.toFixed(1)} fps)`;
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.el.remove();
  }
}
