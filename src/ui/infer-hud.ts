/**
 * Extended debug HUD: top-k predictions, crop preview, ablation toggles, snapshot.
 * Enabled by ?debug URL parameter. Toggle ablation flags without reloading.
 */

import type { AblationFlags, InferCallbackPayload } from "../pipeline/pipeline.js";

const IMAGE_SIZE = 224;

export class InferHud {
  private container: HTMLDivElement;
  private cropCanvas: HTMLCanvasElement;
  private cropCtx: CanvasRenderingContext2D;
  private textEl: HTMLPreElement;
  private cropScaleBtn: HTMLButtonElement;
  private boxAlphaBtn: HTMLButtonElement;

  private lastPayload: InferCallbackPayload | null = null;
  private lastAccepted = false;
  private currentFlags: AblationFlags;
  private readonly video: HTMLVideoElement;
  private readonly onFlagsChange: (f: AblationFlags) => void;

  constructor(
    video: HTMLVideoElement,
    initialFlags: AblationFlags,
    onFlagsChange: (f: AblationFlags) => void,
  ) {
    this.video = video;
    this.currentFlags = { ...initialFlags };
    this.onFlagsChange = onFlagsChange;

    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed", left: "8px", top: "8px", zIndex: "5",
      padding: "8px 10px", borderRadius: "6px",
      background: "rgba(0,0,0,0.78)", color: "#0f0",
      font: "11px/1.5 ui-monospace, monospace",
      pointerEvents: "auto",
      userSelect: "none",
      maxWidth: "280px",
    });

    this.textEl = document.createElement("pre");
    Object.assign(this.textEl.style, { margin: "0 0 6px 0", whiteSpace: "pre-wrap", wordBreak: "break-all" });

    this.cropCanvas = document.createElement("canvas");
    this.cropCanvas.width = IMAGE_SIZE;
    this.cropCanvas.height = IMAGE_SIZE;
    Object.assign(this.cropCanvas.style, {
      display: "block", width: "112px", height: "112px",
      imageRendering: "pixelated", border: "1px solid #333", marginBottom: "6px",
    });
    this.cropCtx = this.cropCanvas.getContext("2d")!;

    // Ablation toggles
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", gap: "4px", marginBottom: "6px", flexWrap: "wrap" });

    this.cropScaleBtn = this.makeToggleBtn("cropScale: OFF", () => this.toggleCropScale());
    this.boxAlphaBtn = this.makeToggleBtn("boxAlpha: 0.60", () => this.toggleBoxAlpha());

    const snapBtn = this.makeToggleBtn("⬇ snap", () => this.downloadSnapshot());
    Object.assign(snapBtn.style, { color: "#ff0" });

    row.appendChild(this.cropScaleBtn);
    row.appendChild(this.boxAlphaBtn);
    row.appendChild(snapBtn);

    this.container.appendChild(this.textEl);
    this.container.appendChild(this.cropCanvas);
    this.container.appendChild(row);
    document.body.appendChild(this.container);

    this.refreshButtonLabels();
  }

  private makeToggleBtn(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = label;
    Object.assign(btn.style, {
      fontSize: "10px", padding: "2px 6px", cursor: "pointer",
      background: "#222", color: "#0f0", border: "1px solid #0f0", borderRadius: "3px",
    });
    btn.addEventListener("click", onClick);
    return btn;
  }

  // Cycle: OFF(1.0) → 0.80 → 0.75 → 0.70 → 0.65 → 0.60 → OFF
  private static readonly CROP_SCALE_STEPS = [1.0, 0.80, 0.75, 0.70, 0.65, 0.60];

  private toggleCropScale(): void {
    const steps = InferHud.CROP_SCALE_STEPS;
    const cur = this.currentFlags.cropScale;
    const idx = steps.findIndex(v => Math.abs(v - cur) < 0.001);
    const next = steps[(idx + 1) % steps.length];
    this.currentFlags = { ...this.currentFlags, cropScale: next };
    this.onFlagsChange(this.currentFlags);
    this.refreshButtonLabels();
  }

  private toggleBoxAlpha(): void {
    const next = this.currentFlags.boxAlpha === 0.6 ? 0.8 : 0.6;
    this.currentFlags = { ...this.currentFlags, boxAlpha: next };
    this.onFlagsChange(this.currentFlags);
    this.refreshButtonLabels();
  }

  private refreshButtonLabels(): void {
    const scaleActive = this.currentFlags.cropScale < 0.999;
    const steps = InferHud.CROP_SCALE_STEPS;
    const idx = steps.findIndex(v => Math.abs(v - this.currentFlags.cropScale) < 0.001);
    const nextVal = steps[(idx + 1) % steps.length];
    const nextLabel = nextVal >= 0.999 ? "OFF" : nextVal.toFixed(2);
    this.cropScaleBtn.textContent = scaleActive
      ? `cropScale: ${this.currentFlags.cropScale.toFixed(2)} → ${nextLabel}`
      : `cropScale: OFF → 0.80`;
    this.cropScaleBtn.style.color = scaleActive ? "#0ff" : "#0f0";

    const alphaChanged = this.currentFlags.boxAlpha !== 0.6;
    this.boxAlphaBtn.textContent = `boxAlpha: ${this.currentFlags.boxAlpha.toFixed(2)}${alphaChanged ? " ✓" : ""}`;
    this.boxAlphaBtn.style.color = alphaChanged ? "#0ff" : "#0f0";
  }

  update(r: InferCallbackPayload, accepted: boolean): void {
    this.lastPayload = r;
    this.lastAccepted = accepted;
    this.currentFlags = { ...r.flags };
    this.refreshButtonLabels();

    if (r.croppedRgb) {
      this.cropCtx.putImageData(r.croppedRgb, 0, 0);
    } else {
      this.cropCtx.clearRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
    }

    const roiLine = r.roiOk
      ? `roi=ok det=${r.detectorOk ? "Y" : "cached"} hands=${r.numHands}`
      : `roi=NONE [${r.reason}]`;
    const boxLine = r.finalBox
      ? `box ${r.finalBox.map(v => v.toString().padStart(3)).join(",")}`
      : "box —";
    const topkLines = r.topK
      .slice(0, 3)
      .map(t => {
        const bar = "█".repeat(Math.round(t.score * 12));
        const marker = t.label === r.predLabel && accepted ? " ✓" : "";
        return ` ${t.label}: ${(t.score * 100).toFixed(1).padStart(5)}% ${bar}${marker}`;
      })
      .join("\n");

    this.textEl.textContent = [roiLine, boxLine, "top-3:", topkLines].join("\n");
  }

  private downloadSnapshot(): void {
    if (!this.lastPayload) return;
    const r = this.lastPayload;

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = this.video.videoWidth;
    frameCanvas.height = this.video.videoHeight;
    frameCanvas.getContext("2d")!.drawImage(this.video, 0, 0);

    const bundle = {
      timestamp: Date.now(),
      image_wh: [this.video.videoWidth, this.video.videoHeight],
      flags: r.flags,
      smoothed_box: r.smoothedBox,
      final_box: r.finalBox,
      roi_ok: r.roiOk,
      detector_ok: r.detectorOk,
      num_hands: r.numHands,
      reason: r.reason,
      pred_label: r.predLabel,
      pred_score: r.predScore,
      pred_margin: r.predMargin,
      topk: r.topK,
      accepted: this.lastAccepted,
      frame_png_b64: frameCanvas.toDataURL("image/png"),
      crop_224_png_b64: r.croppedRgb ? this.cropCanvas.toDataURL("image/png") : null,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug_snapshot_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  destroy(): void {
    this.container.remove();
  }
}
