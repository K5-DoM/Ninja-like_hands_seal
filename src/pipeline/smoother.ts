import {
  SMOOTHER_WINDOW_SIZE,
  SMOOTHER_MIN_COUNT,
  SMOOTHER_SCORE_THRESHOLD,
  SMOOTHER_REJECT_RESET_COUNT,
} from "../data/config.js";

export interface SmoothResult {
  trigger: boolean;
  stableLabel: string;
  state: string;
}

interface HistEntry {
  label: string;
  score: number;
  accepted: boolean;
}

export interface TemporalSmootherOptions {
  windowSize?: number;
  minCount?: number;
  scoreThreshold?: number;
  rejectResetCount?: number;
}

export class TemporalSmoother {
  private history: HistEntry[] = [];
  private readonly windowSize: number;
  private readonly minCount: number;
  private readonly scoreThreshold: number;
  private readonly rejectResetCount: number;
  private currentState: string = "none";
  private rejectStreak: number = 0;

  constructor(opts: TemporalSmootherOptions = {}) {
    this.windowSize = opts.windowSize ?? SMOOTHER_WINDOW_SIZE;
    this.minCount = opts.minCount ?? SMOOTHER_MIN_COUNT;
    this.scoreThreshold = opts.scoreThreshold ?? SMOOTHER_SCORE_THRESHOLD;
    this.rejectResetCount = opts.rejectResetCount ?? SMOOTHER_REJECT_RESET_COUNT;
  }

  reset(): void {
    this.history = [];
    this.currentState = "none";
    this.rejectStreak = 0;
  }

  update(label: string, score: number, accepted: boolean): SmoothResult {
    this.history.push({ label, score, accepted });
    if (this.history.length > this.windowSize) this.history.shift();

    if (!accepted) {
      this.rejectStreak += 1;
      if (this.rejectStreak >= this.rejectResetCount) {
        const prev = this.currentState;
        this.currentState = "none";
        return { stableLabel: "none", trigger: prev !== "none", state: this.currentState };
      }
      return { stableLabel: this.currentState, trigger: false, state: this.currentState };
    }

    this.rejectStreak = 0;
    const acceptedItems = this.history.filter(h => h.accepted);
    if (acceptedItems.length === 0) {
      return { stableLabel: this.currentState, trigger: false, state: this.currentState };
    }

    // Replicate Python Counter.most_common(1): strict > so first-inserted wins on ties
    const counts = new Map<string, number>();
    for (const h of acceptedItems) {
      counts.set(h.label, (counts.get(h.label) ?? 0) + 1);
    }
    let candidate = "";
    let count = -1;
    for (const [lbl, c] of counts) {
      if (c > count) { candidate = lbl; count = c; }
    }

    const candidateScores = acceptedItems
      .filter(h => h.label === candidate)
      .map(h => h.score);
    const avgScore = candidateScores.reduce((a, b) => a + b, 0) / candidateScores.length;
    const stable = count >= this.minCount && avgScore >= this.scoreThreshold;

    if (stable && candidate !== this.currentState) {
      this.currentState = candidate;
      return { stableLabel: candidate, trigger: true, state: this.currentState };
    }
    if (stable) {
      return { stableLabel: candidate, trigger: false, state: this.currentState };
    }
    return { stableLabel: this.currentState, trigger: false, state: this.currentState };
  }
}
