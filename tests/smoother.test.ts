import { describe, expect, it } from "vitest";
import { TemporalSmoother } from "../src/pipeline/smoother.js";

describe("TemporalSmoother", () => {
  // 1: initial state, rejected input → no trigger, state stays "none"
  it("initial state: rejected update stays none", () => {
    const s = new TemporalSmoother();
    const r = s.update("none", 0, false);
    expect(r.trigger).toBe(false);
    expect(r.state).toBe("none");
    expect(r.stableLabel).toBe("none");
  });

  // 2: 8 consecutive accepted same-label + high score → trigger exactly once (minCount=8)
  it("eight consecutive accepted same-label triggers exactly once", () => {
    const s = new TemporalSmoother();
    let triggered = 0;
    for (let i = 0; i < 8; i++) {
      const r = s.update("03", 0.95, true);
      if (r.trigger) triggered++;
    }
    expect(triggered).toBe(1);
    // Further same-label accepted frames do NOT re-trigger
    const r = s.update("03", 0.95, true);
    expect(r.trigger).toBe(false);
  });

  // 3: reject_reset_count reached while state is non-none → trigger=true to signal reset
  it("reject streak resets state and fires trigger when leaving non-none", () => {
    const s = new TemporalSmoother({ rejectResetCount: 3 });
    // Warm up to non-none state (need ≥8 frames for minCount=8)
    for (let i = 0; i < 8; i++) s.update("06", 0.95, true);
    expect(s.update("06", 0.95, true).state).toBe("06");
    // Now reject 3 times
    const r1 = s.update("06", 0, false);
    const r2 = s.update("06", 0, false);
    const r3 = s.update("06", 0, false); // streak = 3 >= rejectResetCount
    expect(r1.trigger).toBe(false);
    expect(r2.trigger).toBe(false);
    expect(r3.trigger).toBe(true);
    expect(r3.state).toBe("none");
  });

  // 4: two labels alternating never stabilise (count never reaches minCount)
  it("alternating two labels never triggers", () => {
    const s = new TemporalSmoother();
    let triggered = 0;
    for (let i = 0; i < 14; i++) {
      const r = s.update(i % 2 === 0 ? "03" : "06", 0.95, true);
      if (r.trigger) triggered++;
    }
    expect(triggered).toBe(0);
  });

  // 5: after trigger, same label continues → no further trigger
  it("no re-trigger on same label after stabilisation", () => {
    const s = new TemporalSmoother();
    // Stabilise on "08" (need ≥8 frames for minCount=8)
    for (let i = 0; i < 8; i++) s.update("08", 0.95, true);
    let extraTriggers = 0;
    for (let i = 0; i < 10; i++) {
      const r = s.update("08", 0.95, true);
      if (r.trigger) extraTriggers++;
    }
    expect(extraTriggers).toBe(0);
  });
});
