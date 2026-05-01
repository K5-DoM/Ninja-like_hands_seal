import { PER_SEAL_TIMEOUT_SEC } from "../data/config.js";

export interface JutsuSpec {
  id: string;
  displayNameJp: string;
  level: number;
  sequence: readonly string[];
  effectId?: string;
}

export type ChallengeEvent =
  | { status: "progress"; step: number }
  | { status: "success"; ts: number }
  | { status: "wrong"; expected: string; got: string; step: number }
  | { status: "ignored" };

export type TickEvent = { status: "timeout"; step: number; elapsed: number };

export class JutsuChallenge {
  readonly spec: JutsuSpec;
  readonly perSealTimeoutSec: number;

  // Public for test parity with Python's _step / _last_event_ts / _done
  step: number;
  lastEventTs: number | null;
  done: boolean;

  constructor(spec: JutsuSpec, perSealTimeoutSec: number = PER_SEAL_TIMEOUT_SEC) {
    this.spec = spec;
    this.perSealTimeoutSec = perSealTimeoutSec;
    this.step = 0;
    this.lastEventTs = null;
    this.done = false;
  }

  start(now: number): void {
    this.step = 0;
    this.lastEventTs = now;
    this.done = false;
  }

  feed(label: string, now: number): ChallengeEvent {
    if (this.done) return { status: "ignored" };
    const expected = this.spec.sequence[this.step];
    if (label !== expected) {
      this.done = true;
      return { status: "wrong", expected, got: label, step: this.step };
    }
    this.step += 1;
    this.lastEventTs = now;
    if (this.step === this.spec.sequence.length) {
      this.done = true;
      return { status: "success", ts: now };
    }
    return { status: "progress", step: this.step };
  }

  // Uses strict > like Python: now - lastEventTs > timeout (not >=)
  tick(now: number): TickEvent | null {
    if (this.done || this.lastEventTs === null) return null;
    if (now - this.lastEventTs > this.perSealTimeoutSec) {
      this.done = true;
      return { status: "timeout", step: this.step, elapsed: now - this.lastEventTs };
    }
    return null;
  }

  expectedNext(): string | null {
    if (this.done || this.step >= this.spec.sequence.length) return null;
    return this.spec.sequence[this.step];
  }

  progress(): readonly [number, number] {
    return [this.step, this.spec.sequence.length] as const;
  }

  remainingSec(now: number): number {
    if (this.lastEventTs === null) return this.perSealTimeoutSec;
    return Math.max(0, this.perSealTimeoutSec - (now - this.lastEventTs));
  }
}
