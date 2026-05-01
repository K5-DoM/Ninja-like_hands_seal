import { describe, expect, it } from "vitest";
import { JutsuChallenge } from "../src/pipeline/challenge.js";
import type { JutsuSpec } from "../src/pipeline/challenge.js";

// Mirror Python test_jutsu_matcher.py — same specs, same fixture names
const BUNSHIN: JutsuSpec = {
  id: "bunshin", displayNameJp: "分身の術", level: 1,
  sequence: ["03", "06", "08"], effectId: "bunshin",
};
const KAGE_SHURIKEN: JutsuSpec = {
  id: "kage_shuriken", displayNameJp: "手裏剣影分身の術", level: 2,
  sequence: ["03", "01", "06", "03"], effectId: "kage_shuriken",
};
const KUCHIYOSE: JutsuSpec = {
  id: "kuchiyose", displayNameJp: "口寄せの術", level: 3,
  sequence: ["12", "11", "10", "09", "08"], effectId: "kuchiyose",
};
const GOKAKYU: JutsuSpec = {
  id: "gokakyu", displayNameJp: "火遁・豪火球の術", level: 4,
  sequence: ["06", "08", "09", "12", "07", "03"], effectId: "gokakyu",
};
const ALL_JUTSU = [BUNSHIN, KAGE_SHURIKEN, KUCHIYOSE, GOKAKYU];

function makeChallenge(spec: JutsuSpec = BUNSHIN, timeout = 3.0) {
  const c = new JutsuChallenge(spec, timeout);
  c.start(0);
  return c;
}

describe("JutsuChallenge", () => {
  // 1
  it("correct sequence returns progress then success", () => {
    const c = makeChallenge(BUNSHIN);
    const r1 = c.feed("03", 0.5);
    expect(r1).toEqual({ status: "progress", step: 1 });

    const r2 = c.feed("06", 1.0);
    expect(r2).toEqual({ status: "progress", step: 2 });

    const r3 = c.feed("08", 1.5);
    expect(r3.status).toBe("success");
    if (r3.status === "success") expect(r3.ts).toBe(1.5);
  });

  // 2
  it("wrong seal at start", () => {
    const c = makeChallenge(BUNSHIN);
    const r = c.feed("99", 0.5);
    expect(r.status).toBe("wrong");
    if (r.status === "wrong") {
      expect(r.expected).toBe("03");
      expect(r.got).toBe("99");
    }
  });

  // 3
  it("wrong seal mid sequence", () => {
    const c = makeChallenge(BUNSHIN);
    c.feed("03", 0.5);
    const r = c.feed("99", 1.0);
    expect(r.status).toBe("wrong");
    if (r.status === "wrong") expect(r.expected).toBe("06");
  });

  // 4
  it("timeout before first seal", () => {
    const c = makeChallenge(BUNSHIN, 3.0);
    expect(c.tick(2.9)).toBeNull();
    const r = c.tick(3.1);
    expect(r).not.toBeNull();
    expect(r!.status).toBe("timeout");
  });

  // 5
  it("timeout between seals", () => {
    const c = makeChallenge(BUNSHIN, 3.0);
    c.feed("03", 1.0);
    expect(c.tick(3.9)).toBeNull();
    const r = c.tick(4.1);
    expect(r).not.toBeNull();
    expect(r!.status).toBe("timeout");
  });

  // 6
  it("near timeout progress succeeds", () => {
    const c = makeChallenge(BUNSHIN, 3.0);
    c.feed("03", 0.0);
    const r = c.feed("06", 2.9);
    expect(r.status).toBe("progress");
  });

  // 7
  it("feed after success is ignored", () => {
    const c = makeChallenge(BUNSHIN);
    c.feed("03", 0.1);
    c.feed("06", 0.2);
    c.feed("08", 0.3);
    const r = c.feed("03", 0.4);
    expect(r).toEqual({ status: "ignored" });
  });

  // 8
  it("tick after success returns null", () => {
    const c = makeChallenge(BUNSHIN);
    c.feed("03", 0.1);
    c.feed("06", 0.2);
    c.feed("08", 0.3);
    expect(c.tick(99.0)).toBeNull();
  });

  // 9
  it("progress tracking", () => {
    const c = makeChallenge(BUNSHIN);
    expect(c.progress()).toEqual([0, 3]);
    c.feed("03", 0.1);
    expect(c.progress()).toEqual([1, 3]);
    c.feed("06", 0.2);
    expect(c.progress()).toEqual([2, 3]);
  });

  // 10
  it("expected next", () => {
    const c = makeChallenge(BUNSHIN);
    expect(c.expectedNext()).toBe("03");
    c.feed("03", 0.1);
    expect(c.expectedNext()).toBe("06");
  });

  // 11
  it("expected next is null after success", () => {
    const c = makeChallenge(BUNSHIN);
    c.feed("03", 0.1);
    c.feed("06", 0.2);
    c.feed("08", 0.3);
    expect(c.expectedNext()).toBeNull();
  });

  // 12
  it("remaining sec decreases", () => {
    const c = makeChallenge(BUNSHIN, 3.0);
    c.feed("03", 0.0);
    expect(Math.abs(c.remainingSec(1.0) - 2.0)).toBeLessThan(1e-9);
    expect(Math.abs(c.remainingSec(2.9) - 0.1)).toBeLessThan(1e-6);
  });

  // 13
  it("remaining sec floors at zero", () => {
    const c = makeChallenge(BUNSHIN, 3.0);
    c.feed("03", 0.0);
    expect(c.remainingSec(100.0)).toBe(0.0);
  });

  // 14
  it("restart after wrong", () => {
    const c = makeChallenge(BUNSHIN);
    c.feed("99", 0.1);
    expect(c.done).toBe(true);
    c.start(1.0);
    const r = c.feed("03", 1.1);
    expect(r.status).toBe("progress");
  });

  // 15-18: canonical sequences for all 4 jutsu
  for (const spec of ALL_JUTSU) {
    it(`canonical sequence succeeds: ${spec.id}`, () => {
      const c = new JutsuChallenge(spec, 3.0);
      c.start(0.0);
      for (let i = 0; i < spec.sequence.length; i++) {
        const r = c.feed(spec.sequence[i], i * 0.5);
        if (i < spec.sequence.length - 1) {
          expect(r.status).toBe("progress");
        } else {
          expect(r.status).toBe("success");
        }
      }
    });
  }
});
