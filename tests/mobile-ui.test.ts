import { describe, expect, it } from "vitest";
import type { GameState } from "../src/state/game.js";
import { ENDLESS_MODES, JUTSU_LIST } from "../src/data/jutsu.js";

describe("mobile setup HUD", () => {
  it("does not render a bottom prompt while setup controls are visible", async () => {
    const { deriveBottomInput } = await import("../src/render/canvas.js");
    const jutsu = JUTSU_LIST[0];
    const endless = ENDLESS_MODES[0];
    const setupStates: GameState[] = [
      { phase: { kind: "idle" } },
      { phase: { kind: "ready", jutsu } },
      { phase: { kind: "endless_ready", spec: endless } },
    ];

    for (const state of setupStates) {
      expect(deriveBottomInput(state, null, 0).text).toBe("");
    }
  });
});
