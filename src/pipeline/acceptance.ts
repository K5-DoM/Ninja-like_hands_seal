import {
  ACCEPT_REJECT_THRESHOLD,
  ACCEPT_MARGIN_THRESHOLD,
  ACCEPT_SINGLE_HAND_RELAX,
  ACCEPT_REJECT_THRESHOLD_BY_LABEL,
} from "../data/config.js";

export interface AcceptanceOptions {
  rejectThreshold?: number;
  marginThreshold?: number;
  singleHandRelax?: number;
  rejectThresholdByLabel?: Record<string, number>;
}

export interface InferResultLite {
  predLabel: string;
  predScore: number;
  predMargin: number;
  roiOk: boolean;
  detectorOk: boolean;
  numHands: number | null;
}

export function computeAcceptance(r: InferResultLite, opts: AcceptanceOptions = {}): boolean {
  if (!r.roiOk) return false;
  // Cached ROI (detectorOk=false) is excluded from stability judgement, same as Python
  if (!r.detectorOk) return false;

  const byLabel = opts.rejectThresholdByLabel ?? ACCEPT_REJECT_THRESHOLD_BY_LABEL;
  let thr = byLabel[r.predLabel] ?? (opts.rejectThreshold ?? ACCEPT_REJECT_THRESHOLD);
  const marginThr = opts.marginThreshold ?? ACCEPT_MARGIN_THRESHOLD;
  const relax = opts.singleHandRelax ?? ACCEPT_SINGLE_HAND_RELAX;
  if (r.numHands === 1) thr = Math.max(0, thr - relax);
  return r.predScore >= thr && r.predMargin >= marginThr;
}
