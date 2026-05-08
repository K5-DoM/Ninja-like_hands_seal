import type { GameState } from "../state/game.js";
import { PER_SEAL_TIMEOUT_SEC } from "../data/config.js";
import type { AnyChallenge } from "../pipeline/pipeline.js";
import { EndlessChallenge } from "../pipeline/endless.js";
import type { SealThumbMap } from "./assets.js";
import {
  drawTopStrip, drawBottomBar, drawEndlessHud,
  DEFAULT_STRIP, DEFAULT_BOTTOM, DEFAULT_ENDLESS,
} from "./hud.js";
import type { BottomBarRenderInput } from "./hud.js";
import { displayName } from "../data/jutsu.js";

export interface RendererInputs {
  getState: () => GameState;
  getChallenge: () => AnyChallenge | null;
}

export class Renderer {
  private rafId: number | null = null;
  private dpr = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly thumbs: SealThumbMap,
    private readonly inputs: RendererInputs,
  ) {
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResize);
    this.handleResize();
  }

  private handleResize(): void {
    this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  start(): void {
    if (this.rafId !== null) return;
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.draw();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private draw(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const state = this.inputs.getState();
    const challenge = this.inputs.getChallenge();
    const nowSec = performance.now() / 1000;

    const phase = state.phase;
    if (phase.kind === "endless_running" || phase.kind === "endless_gameover") {
      const currentSeal = challenge instanceof EndlessChallenge
        ? challenge.getCurrent()
        : "01";
      // gameover 時は Result Overlay (DOM) が出るのでカウンタ + 印は描画しない
      if (phase.kind === "endless_running") {
        drawEndlessHud(ctx, cssW, cssH, phase.count, currentSeal, this.thumbs, nowSec, DEFAULT_ENDLESS);
      }
    } else if (phase.kind !== "idle") {
      const jutsu =
        phase.kind === "ready"   ? phase.jutsu :
        phase.kind === "running" ? phase.jutsu :
        phase.kind === "success" ? phase.jutsu :
        phase.kind === "failure" ? phase.jutsu : null;
      const confirmed =
        phase.kind === "running" ? phase.confirmedSteps :
        phase.kind === "success" ? jutsu!.sequence.length :
        phase.kind === "failure" ? phase.confirmedAtFail : 0;
      if (jutsu) {
        const topOffset = cssH * 0.04;
        drawTopStrip(ctx, cssW, topOffset, jutsu, confirmed, this.thumbs, nowSec, DEFAULT_STRIP);
      }
    }

    const bottomInput = deriveBottomInput(state, challenge, nowSec);
    if (bottomInput.text || bottomInput.remainingSec !== null) {
      drawBottomBar(ctx, cssW, cssH, bottomInput, DEFAULT_BOTTOM);
    }
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
  }
}

export function deriveBottomInput(
  state: GameState,
  challenge: AnyChallenge | null,
  nowSec: number,
): BottomBarRenderInput {
  const phase = state.phase;
  let text = "";
  let remainingSec: number | null = null;
  let perSealTimeoutSec = PER_SEAL_TIMEOUT_SEC;
  let isWarning = false;

  if (phase.kind === "running" && challenge) {
    perSealTimeoutSec = challenge.perSealTimeoutSec;
    remainingSec = challenge.remainingSec(nowSec);
    isWarning = remainingSec < 1.0;
    text = isWarning ? "Hurry up!" : "Form the seals!";
  } else if (phase.kind === "success") {
    text = displayName(phase.jutsu);
  } else if (phase.kind === "failure") {
    text = "";  // flash（DOM）がメッセージを担当
  } else if (phase.kind === "endless_running" && challenge) {
    perSealTimeoutSec = challenge.perSealTimeoutSec;
    remainingSec = challenge.remainingSec(nowSec);
    isWarning = remainingSec < 1.0;
    text = isWarning ? "Hurry up!" : `Endless — ${phase.count}`;
  } else if (phase.kind === "endless_gameover") {
    text = phase.reason === "wrong" ? "Wrong seal!" : "Time up!";
  }

  const blink = (Math.floor(nowSec / 0.3) % 2) === 0;
  return { text, remainingSec, perSealTimeoutSec, isWarning, blink };
}
