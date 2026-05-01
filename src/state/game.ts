import type { JutsuSpec } from "../pipeline/challenge.js";
import type { EndlessSpec } from "../data/jutsu.js";

export type Phase =
  | { kind: "idle" }
  | { kind: "ready"; jutsu: JutsuSpec }
  | { kind: "running"; jutsu: JutsuSpec; confirmedSteps: number }
  | { kind: "success"; jutsu: JutsuSpec }
  | { kind: "failure"; jutsu: JutsuSpec; failureKind: "wrong" | "timeout"; confirmedAtFail: number }
  | { kind: "endless_ready"; spec: EndlessSpec }
  | { kind: "endless_running"; spec: EndlessSpec; count: number }
  | { kind: "endless_gameover"; spec: EndlessSpec; count: number; reason: "timeout" | "wrong" };

export interface GameState {
  phase: Phase;
}

export const initialState: GameState = { phase: { kind: "idle" } };

export function selectJutsu(_s: GameState, jutsu: JutsuSpec): GameState {
  return { phase: { kind: "ready", jutsu } };
}

export function startGame(s: GameState): GameState {
  if (s.phase.kind !== "ready" && s.phase.kind !== "failure" && s.phase.kind !== "success") return s;
  const jutsu = (s.phase as { jutsu: JutsuSpec }).jutsu;
  return { phase: { kind: "running", jutsu, confirmedSteps: 0 } };
}

export function onProgress(s: GameState, step: number): GameState {
  if (s.phase.kind !== "running") return s;
  return { phase: { ...s.phase, confirmedSteps: step } };
}

export function onSuccess(s: GameState): GameState {
  if (s.phase.kind !== "running") return s;
  return { phase: { kind: "success", jutsu: s.phase.jutsu } };
}

export function onWrong(s: GameState): GameState {
  if (s.phase.kind !== "running") return s;
  return { phase: { kind: "failure", jutsu: s.phase.jutsu, failureKind: "wrong",
                    confirmedAtFail: s.phase.confirmedSteps } };
}

export function onTimeout(s: GameState): GameState {
  if (s.phase.kind !== "running") return s;
  return { phase: { kind: "failure", jutsu: s.phase.jutsu, failureKind: "timeout",
                    confirmedAtFail: s.phase.confirmedSteps } };
}

export function selectEndlessMode(_s: GameState, spec: EndlessSpec): GameState {
  return { phase: { kind: "endless_ready", spec } };
}

export function startEndlessGame(s: GameState): GameState {
  if (s.phase.kind !== "endless_ready" && s.phase.kind !== "endless_gameover") return s;
  return { phase: { kind: "endless_running", spec: s.phase.spec, count: 0 } };
}

export function onEndlessAdvance(s: GameState, count: number): GameState {
  if (s.phase.kind !== "endless_running") return s;
  return { phase: { ...s.phase, count } };
}

export function onEndlessGameover(
  s: GameState, count: number, reason: "timeout" | "wrong",
): GameState {
  if (s.phase.kind !== "endless_running") return s;
  return { phase: { kind: "endless_gameover", spec: s.phase.spec, count, reason } };
}
