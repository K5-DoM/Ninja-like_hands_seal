import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export type Box = [number, number, number, number]; // [x0, y0, x1, y1]

export interface HandROIResult {
  box: Box | null;
  roiOk: boolean;
  numHands: number;
  avgScore: number | null;
  reason: string;
}

export interface HandDetectorOptions {
  modelAssetPath: string;
  wasmPath: string;
  numHands?: number;
  minHandDetectionConfidence?: number;
  minHandPresenceConfidence?: number;
  minTrackingConfidence?: number;
  minSizeRatio?: number;
  requireTwoHands?: boolean;
}

export async function createHandDetector(opts: HandDetectorOptions) {
  const vision = await FilesetResolver.forVisionTasks(opts.wasmPath);
  // NOTE:
  //   Python uses RunningMode.LIVE_STREAM + detect_async() in infer_webcam_rgb.
  //   For Web JS HandLandmarker, the official guide exposes IMAGE / VIDEO and
  //   detectForVideo() for camera streams, so we keep VIDEO here while matching
  //   the rest of the ROI logic 1:1 with Python.
  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: opts.modelAssetPath },
    runningMode: "VIDEO",
    numHands: opts.numHands ?? 2,
    minHandDetectionConfidence: opts.minHandDetectionConfidence ?? 0.35,
    minHandPresenceConfidence: opts.minHandPresenceConfidence ?? 0.35,
    minTrackingConfidence: opts.minTrackingConfidence ?? 0.35,
  });

  // Match CropConfig.hand_min_size_ratio default in Python inference path.
  const minSizeRatio = opts.minSizeRatio ?? 0.12;
  const requireTwoHands = opts.requireTwoHands ?? false;
  const maxNumHands = opts.numHands ?? 2;
  let lastTimestampMs = -1;

  return {
    detect(video: HTMLVideoElement, timestampMs: number): HandROIResult {
      // Ensure monotonic timestamps, same as Python
      if (timestampMs <= lastTimestampMs) timestampMs = lastTimestampMs + 1;
      lastTimestampMs = timestampMs;

      let result: ReturnType<typeof landmarker.detectForVideo>;
      try {
        result = landmarker.detectForVideo(video, timestampMs);
      } catch (e) {
        return { box: null, roiOk: false, numHands: 0, avgScore: null, reason: `detect_error: ${e}` };
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      const lmList = result.landmarks ?? [];
      const handedness = result.handedness ?? [];
      const numHands = lmList.length;

      if (numHands === 0) {
        return { box: null, roiOk: false, numHands: 0, avgScore: null, reason: "no_hands" };
      }

      const scores: number[] = [];
      for (const hs of handedness) {
        if (hs && hs.length > 0) scores.push(hs[0].score);
      }
      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;

      if (requireTwoHands && numHands < 2) {
        return { box: null, roiOk: false, numHands, avgScore, reason: "less_than_two_hands" };
      }

      const perHandBoxes: Box[] = [];
      for (let i = 0; i < Math.min(maxNumHands, numHands); i++) {
        const lm = lmList[i];
        if (!lm || lm.length === 0) continue;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of lm) {
          const x = p.x * width, y = p.y * height;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        perHandBoxes.push([Math.floor(minX), Math.floor(minY), Math.floor(maxX), Math.floor(maxY)]);
      }

      if (perHandBoxes.length === 0) {
        return { box: null, roiOk: false, numHands, avgScore, reason: "empty_landmarks" };
      }

      const box = makeRoiBox(perHandBoxes, width, height);
      if (box === null) {
        return { box: null, roiOk: false, numHands, avgScore, reason: "invalid_box" };
      }

      const minSize = Math.round(Math.min(width, height) * minSizeRatio);
      if ((box[2] - box[0]) < minSize || (box[3] - box[1]) < minSize) {
        return { box: null, roiOk: false, numHands, avgScore, reason: "box_too_small" };
      }

      return {
        box,
        roiOk: true,
        numHands,
        avgScore,
        reason: numHands >= 2 ? "ok_two_hands" : "ok_single_hand_fallback",
      };
    },

    close() { landmarker.close(); },
  };
}

// Port of Python square_box_within — shift-then-clamp so the box stays square near edges.
// Unlike independent per-axis clipping, this guarantees x1-x0 === y1-y0 (up to rounding).
export function squareBoxWithin(
  cx: number, cy: number, side: number, width: number, height: number,
): Box | null {
  side = Math.min(side, width, height);
  if (side <= 0) return null;
  const half = side / 2;
  let x0 = cx - half, x1 = cx + half;
  let y0 = cy - half, y1 = cy + half;
  if (x0 < 0) { x1 -= x0; x0 = 0; }
  if (x1 > width) { x0 -= (x1 - width); x1 = width; }
  if (y0 < 0) { y1 -= y0; y0 = 0; }
  if (y1 > height) { y0 -= (y1 - height); y1 = height; }
  return [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
}

// Port of Python MediaPipeHandsBoxDetector._make_roi_box — must match exactly
function makeRoiBox(perHand: Box[], width: number, height: number): Box | null {
  if (perHand.length >= 2) {
    const x0 = Math.min(...perHand.map(b => b[0]));
    const y0 = Math.min(...perHand.map(b => b[1]));
    const x1 = Math.max(...perHand.map(b => b[2]));
    const y1 = Math.max(...perHand.map(b => b[3]));
    const bw = Math.max(1, x1 - x0);
    const bh = Math.max(1, y1 - y0);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const roiW = bw * 1.45;
    const roiH = bh * 2.35; // actual span: 1.00*bh above + 1.35*bh below center
    const boxCy = cy + bh * 0.175; // vertical center of intended region
    const side = Math.max(roiW, roiH);
    return squareBoxWithin(cx, boxCy, side, width, height);
  }

  const [x0, y0, x1, y1] = perHand[0];
  const bw = Math.max(1, x1 - x0);
  const bh = Math.max(1, y1 - y0);
  const handCx = (x0 + x1) / 2;
  const handCy = (y0 + y1) / 2;
  const imageCx = width / 2;
  const shiftX = 0.35 * (imageCx - handCx);
  const shiftY = 0.10 * (height * 0.5 - handCy);
  const cx = handCx + shiftX;
  const cy = handCy + shiftY;
  const roiW = bw * 1.85;
  const roiH = bh * 2.80; // actual span: 1.10*bh above + 1.70*bh below center
  const boxCy = cy + bh * 0.30; // vertical center of intended region
  const side = Math.max(roiW, roiH);
  return squareBoxWithin(cx, boxCy, side, width, height);
}

export class BoxSmoother {
  private lastBox: Box | null = null;
  private missingCount = 0;

  constructor(
    private readonly alpha: number = 0.6,
    private readonly maxMissing: number = 4,
  ) {}

  update(box: Box | null): Box | null {
    if (box === null) {
      this.missingCount += 1;
      if (this.missingCount > this.maxMissing) this.lastBox = null;
      return this.lastBox;
    }
    this.missingCount = 0;
    if (this.lastBox === null) {
      this.lastBox = [...box] as Box;
      return this.lastBox;
    }
    const a = this.alpha;
    this.lastBox = this.lastBox.map((prev, i) =>
      Math.round((1 - a) * prev + a * box[i]),
    ) as Box;
    return this.lastBox;
  }

  reset(): void {
    this.lastBox = null;
    this.missingCount = 0;
  }

  getLastBox(): Box | null {
    return this.lastBox ? [...this.lastBox] as Box : null;
  }

  seedBox(box: Box): void {
    this.lastBox = [...box] as Box;
    this.missingCount = 0;
  }
}
