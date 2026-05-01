import * as ort from "onnxruntime-web";
import { createHandDetector, BoxSmoother } from "./hand.js";
import type { HandROIResult, Box } from "./hand.js";
import {
  SealPreprocessor,
  softmax,
  buildInferResult,
  loadSealSession,
  loadIdxToClass,
} from "./seal.js";
import type { InferResult } from "./seal.js";
import { TemporalSmoother } from "./smoother.js";
import type { SmoothResult } from "./smoother.js";
import { JutsuChallenge } from "./challenge.js";
import type { ChallengeEvent, TickEvent, JutsuSpec } from "./challenge.js";
import { EndlessChallenge } from "./endless.js";
import type { EndlessEvent, EndlessMode } from "./endless.js";
import { computeAcceptance } from "./acceptance.js";
import { PER_SEAL_TIMEOUT_SEC,DEFAULT_CROP } from "../data/config.js";

export type AnyChallenge = JutsuChallenge | EndlessChallenge;
export type AnyChallengeEvent = ChallengeEvent | TickEvent | EndlessEvent;

const INFER_PERIOD_MS = 100; // 10 fps target

export interface PipelineConfig {
  modelUrl: string;
  idxMapUrl: string;
  handLandmarkerPath: string;
  mpVisionWasmPath: string;
  perSealTimeoutSec?: number;
}

// Extended inference result including debug-only fields.
export type InferCallbackPayload = InferResult
  & Pick<HandROIResult, "roiOk" | "numHands" | "reason">
  & {
    detectorOk: boolean;
    /** The smoothed ROI box before any ablation shrink (null if no ROI). */
    smoothedBox: Box | null;
    /** The box actually passed to the crop step (may be shrunk from smoothedBox). */
    finalBox: Box | null;
    /** Active ablation flags at inference time. */
    flags: AblationFlags;
  };

export interface PipelineCallbacks {
  onInfer?: (r: InferCallbackPayload, accepted: boolean) => void;
  onSmooth?: (r: SmoothResult) => void;
  onChallengeEvent?: (e: AnyChallengeEvent) => void;
}

// ---------------------------------------------------------------------------
// Ablation flags — read once from URL query params at startup.
// ?cropScale=0.82  → mirror Python's inference_crop_scale shrink (H1)
// ?boxAlpha=0.8    → match Python's BoxSmoother alpha default (H2)
// ---------------------------------------------------------------------------
export interface AblationFlags {
  /** Multiplier applied to the smoothed bbox before cropping (1.0 = no shrink = web default). */
  cropScale: number;
  /** BoxSmoother EMA alpha (0.6 = web default, 0.8 = Python infer_webcam_rgb default). */
  boxAlpha: number;
}

function readAblationFlags(): AblationFlags {
  const p = new URLSearchParams(location.search);
  // cropScale default is 0.6 — validated to give the best web inference accuracy.
  // Override via ?cropScale=X only for ablation testing (?debug mode).
  const cropScale = p.has("cropScale")
    ? Math.min(1.0, Math.max(0.1, Number(p.get("cropScale")) || DEFAULT_CROP))
    : DEFAULT_CROP;
  const boxAlpha = p.has("boxAlpha")
    ? Math.min(1.0, Math.max(0.0, Number(p.get("boxAlpha")) || DEFAULT_CROP))
    : DEFAULT_CROP;
  return { cropScale, boxAlpha };
}

/**
 * Mirror of BaseInferencer._shrink_box in infer_webcam_rgb.py.
 * Shrinks the smoothed bbox around its center by `scale` before cropping.
 */
function shrinkBox(box: Box, videoWidth: number, videoHeight: number, scale: number): Box {
  if (scale >= 0.999) return box;
  const [x0, y0, x1, y1] = box;
  const bw = Math.max(1, x1 - x0);
  const bh = Math.max(1, y1 - y0);
  const cx = x0 + bw / 2;
  const cy = y0 + bh / 2;
  const nw = Math.max(1, bw * scale);
  const nh = Math.max(1, bh * scale);
  let nx0 = Math.round(cx - nw / 2);
  let ny0 = Math.round(cy - nh / 2);
  let nx1 = Math.round(cx + nw / 2);
  let ny1 = Math.round(cy + nh / 2);
  nx0 = Math.max(0, Math.min(nx0, videoWidth - 1));
  ny0 = Math.max(0, Math.min(ny0, videoHeight - 1));
  nx1 = Math.max(nx0 + 1, Math.min(nx1, videoWidth));
  ny1 = Math.max(ny0 + 1, Math.min(ny1, videoHeight));
  return [nx0, ny0, nx1, ny1];
}

export class Pipeline {
  private session!: ort.InferenceSession;
  private idxToClass!: Record<string, string>;
  private hand!: Awaited<ReturnType<typeof createHandDetector>>;
  private flags: AblationFlags;
  private boxSmoother: BoxSmoother;
  private prep = new SealPreprocessor();
  private smoother = new TemporalSmoother();
  private inputName!: string;

  private challenge: AnyChallenge | null = null;
  private rafId: number | null = null;
  private lastInferAt = -Infinity;
  private busy = false;

  constructor(
    private readonly cfg: PipelineConfig,
    private readonly video: HTMLVideoElement,
    private readonly cbs: PipelineCallbacks = {},
  ) {
    this.flags = readAblationFlags();
    this.boxSmoother = new BoxSmoother(this.flags.boxAlpha, 4);
    if (this.flags.cropScale !== DEFAULT_CROP || this.flags.boxAlpha !== 0.6) {
      console.info("[pipeline] ablation flags overridden via URL params:", this.flags);
    }
  }

  async init(): Promise<void> {
    [this.session, this.idxToClass, this.hand] = await Promise.all([
      loadSealSession(this.cfg.modelUrl),
      loadIdxToClass(this.cfg.idxMapUrl),
      createHandDetector({
        modelAssetPath: this.cfg.handLandmarkerPath,
        wasmPath: this.cfg.mpVisionWasmPath,
      }),
    ]);
    this.inputName = this.session.inputNames[0];
  }

  startJutsu(spec: JutsuSpec): void {
    const now = performance.now() / 1000;
    this.challenge = new JutsuChallenge(spec, this.cfg.perSealTimeoutSec ?? PER_SEAL_TIMEOUT_SEC);
    this.challenge.start(now);
    this.smoother.reset();
    this.boxSmoother.reset();
  }

  startEndless(mode: EndlessMode): void {
    const now = performance.now() / 1000;
    this.challenge = new EndlessChallenge(mode, this.cfg.perSealTimeoutSec ?? PER_SEAL_TIMEOUT_SEC);
    this.challenge.start(now);
    this.smoother.reset();
    this.boxSmoother.reset();
  }

  cancelJutsu(): void {
    this.challenge = null;
  }

  peekChallenge(): AnyChallenge | null {
    return this.challenge;
  }

  getFlags(): AblationFlags {
    return { ...this.flags };
  }

  /** Update ablation flags at runtime (no page reload needed). */
  setAblationFlags(partial: Partial<AblationFlags>): void {
    const prev = this.flags;
    this.flags = { ...prev, ...partial };
    if (this.flags.boxAlpha !== prev.boxAlpha) {
      const lastBox = this.boxSmoother.getLastBox();
      this.boxSmoother = new BoxSmoother(this.flags.boxAlpha, 4);
      if (lastBox) this.boxSmoother.seedBox(lastBox);
    }
    console.info("[pipeline] ablation flags updated:", this.flags);
  }

  start(): void {
    if (this.rafId !== null) return;
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.tickFrame();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tickFrame(): void {
    if (this.video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;
    const nowMs = performance.now();
    const nowSec = nowMs / 1000;

    if (this.challenge) {
      const t = this.challenge.tick(nowSec);
      if (t) this.cbs.onChallengeEvent?.(t);
    }

    if (this.busy || nowMs - this.lastInferAt < INFER_PERIOD_MS) return;
    this.lastInferAt = nowMs;
    this.busy = true;
    this.runInferOnce(nowMs, nowSec)
      .catch(e => console.error("[pipeline] infer error", e))
      .finally(() => { this.busy = false; });
  }

  private async runInferOnce(nowMs: number, nowSec: number): Promise<void> {
    const handResult = this.hand.detect(this.video, nowMs);
    const detectorOk = handResult.roiOk;
    const rawBox = detectorOk ? handResult.box : null;
    const smoothedBox = this.boxSmoother.update(rawBox);

    if (smoothedBox === null) {
      const noRoiResult: InferResult = {
        predLabel: "none", predScore: 0, predMargin: 0, topK: [], croppedRgb: null,
      };
      this.cbs.onInfer?.(
        {
          ...noRoiResult,
          roiOk: false, numHands: handResult.numHands, reason: handResult.reason,
          detectorOk,
          smoothedBox: null,
          finalBox: null,
          flags: this.flags,
        },
        false,
      );
      const sm = this.smoother.update("none", 0, false);
      this.cbs.onSmooth?.(sm);
      this.maybeFeedChallenge(sm, nowSec);
      return;
    }

    const finalBox = shrinkBox(
      smoothedBox,
      this.video.videoWidth,
      this.video.videoHeight,
      this.flags.cropScale,
    );

    const cropImg = this.prep.crop(this.video, finalBox);
    const tensor = this.prep.toTensor(cropImg);
    const inferStart = performance.now();
    const out = await this.session.run({ [this.inputName]: tensor });
    const inferMs = performance.now() - inferStart;
    const logits = out[this.session.outputNames[0]].data as Float32Array;
    const probs = softmax(logits);
    const head = buildInferResult(probs, this.idxToClass);

    const inferRes: InferResult = { ...head, croppedRgb: cropImg, inferMs };
    const accepted = computeAcceptance({
      predLabel: head.predLabel,
      predScore: head.predScore,
      predMargin: head.predMargin,
      roiOk: true,
      detectorOk,
      numHands: handResult.numHands,
    });
    this.cbs.onInfer?.(
      {
        ...inferRes,
        roiOk: true, numHands: handResult.numHands, reason: handResult.reason,
        detectorOk,
        smoothedBox,
        finalBox,
        flags: this.flags,
      },
      accepted,
    );

    const sm = this.smoother.update(head.predLabel, head.predScore, accepted);
    this.cbs.onSmooth?.(sm);
    this.maybeFeedChallenge(sm, nowSec);
  }

  private maybeFeedChallenge(sm: SmoothResult, nowSec: number): void {
    if (!this.challenge || !sm.trigger || sm.stableLabel === "none") return;
    const ev = this.challenge.feed(sm.stableLabel, nowSec);
    this.cbs.onChallengeEvent?.(ev);
  }
}
