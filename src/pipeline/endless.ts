import { PER_SEAL_TIMEOUT_SEC } from "../data/config.js";

const SEAL_LABELS = [
  "01", "02", "03", "04", "05", "06",
  "07", "08", "09", "10", "11", "12",
] as const;

export type EndlessMode = "random" | "sequential";

export type EndlessEvent =
  | { status: "endless_advance"; count: number; nextSeal: string }
  | { status: "endless_gameover"; count: number; reason: "timeout" | "wrong" }
  | { status: "ignored" };

export class EndlessChallenge {
  readonly mode: EndlessMode;
  readonly perSealTimeoutSec: number;
  private currentSeal: string;
  private prevSeal: string | null = null;
  private count = 0;
  private deadline = 0;
  private over = false;
  private rng: () => number;

  constructor(
    mode: EndlessMode,
    perSealTimeoutSec: number = PER_SEAL_TIMEOUT_SEC,
    rng: () => number = Math.random,
  ) {
    this.mode = mode;
    this.perSealTimeoutSec = perSealTimeoutSec;
    this.rng = rng;
    this.currentSeal = mode === "sequential" ? "01" : this.pickRandom(null);
  }

  start(now: number): void {
    this.deadline = now + this.perSealTimeoutSec;
    this.over = false;
  }

  getCurrent(): string { return this.currentSeal; }
  getCount(): number { return this.count; }
  isOver(): boolean { return this.over; }

  feed(label: string, now: number): EndlessEvent {
    if (this.over) return { status: "ignored" };
    if (label !== this.currentSeal) {
      this.over = true;
      return { status: "endless_gameover", count: this.count, reason: "wrong" };
    }
    this.count++;
    this.prevSeal = this.currentSeal;
    this.currentSeal = this.advance();
    this.deadline = now + this.perSealTimeoutSec;
    return { status: "endless_advance", count: this.count, nextSeal: this.currentSeal };
  }

  tick(now: number): { status: "endless_gameover"; count: number; reason: "timeout" } | null {
    if (this.over) return null;
    if (now > this.deadline) {
      this.over = true;
      return { status: "endless_gameover", count: this.count, reason: "timeout" };
    }
    return null;
  }

  remainingSec(now: number): number {
    return Math.max(0, this.deadline - now);
  }

  private advance(): string {
    if (this.mode === "sequential") {
      const idx = SEAL_LABELS.indexOf(this.currentSeal as typeof SEAL_LABELS[number]);
      return SEAL_LABELS[(idx + 1) % SEAL_LABELS.length];
    }
    return this.pickRandom(this.currentSeal);
  }

  private pickRandom(avoid: string | null): string {
    const pool = avoid === null
      ? SEAL_LABELS
      : SEAL_LABELS.filter(s => s !== avoid);
    return pool[Math.floor(this.rng() * pool.length)];
  }
}
