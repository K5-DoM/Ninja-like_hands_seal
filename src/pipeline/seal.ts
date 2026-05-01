import * as ort from "onnxruntime-web";
import type { Box } from "./hand.js";

const IMAGE_SIZE = 224;
const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

export interface InferResult {
  predLabel: string;
  predScore: number;
  predMargin: number;
  topK: { label: string; score: number; index: number }[];
  croppedRgb: ImageData | null;
  inferMs?: number;
}

export async function loadSealSession(modelUrl: string): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(modelUrl, { executionProviders: ["wasm"] });
}

export async function loadIdxToClass(url: string): Promise<Record<string, string>> {
  const res = await fetch(url);
  return res.json() as Promise<Record<string, string>>;
}

export class SealPreprocessor {
  private readonly cropCanvas: HTMLCanvasElement | OffscreenCanvas;
  private readonly cropCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  constructor() {
    if (typeof OffscreenCanvas !== "undefined") {
      this.cropCanvas = new OffscreenCanvas(IMAGE_SIZE, IMAGE_SIZE);
      this.cropCtx = this.cropCanvas.getContext("2d")!;
    } else {
      const c = document.createElement("canvas");
      c.width = c.height = IMAGE_SIZE;
      this.cropCanvas = c;
      this.cropCtx = c.getContext("2d")!;
    }
  }

  crop(video: HTMLVideoElement, box: Box): ImageData {
    const [x0, y0, x1, y1] = box;
    const sw = x1 - x0, sh = y1 - y0;
    // Box from squareBoxWithin is always square; center-adjust for ±1 rounding edge case
    const side = Math.max(sw, sh);
    const srcX = x0 - (side - sw) / 2;
    const srcY = y0 - (side - sh) / 2;
    this.cropCtx.drawImage(video, srcX, srcY, side, side, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
    return this.cropCtx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  }

  toTensor(img: ImageData): ort.Tensor {
    const { data } = img;
    const n = IMAGE_SIZE * IMAGE_SIZE;
    const f32 = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) {
      f32[i]         = (data[i * 4]     / 255 - MEAN[0]) / STD[0];
      f32[n + i]     = (data[i * 4 + 1] / 255 - MEAN[1]) / STD[1];
      f32[2 * n + i] = (data[i * 4 + 2] / 255 - MEAN[2]) / STD[2];
    }
    return new ort.Tensor("float32", f32, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);
  }
}

export function softmax(logits: Float32Array): Float32Array {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  const out = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < out.length; i++) { out[i] = Math.exp(logits[i] - max); sum += out[i]; }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

export function topK(
  probs: Float32Array,
  idxToClass: Record<string, string>,
  k: number,
) {
  return Array.from(probs)
    .map((c, i) => ({ label: idxToClass[String(i)] ?? `cls${i}`, score: c, index: i }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function buildInferResult(
  probs: Float32Array,
  idxToClass: Record<string, string>,
): Pick<InferResult, "predLabel" | "predScore" | "predMargin" | "topK"> {
  const top = topK(probs, idxToClass, 3);
  const top1 = top[0]?.score ?? 0;
  const top2 = top[1]?.score ?? 0;
  return {
    predLabel: top[0]?.label ?? "none",
    predScore: top1,
    predMargin: top1 - top2,
    topK: top,
  };
}
