import { describe, expect, it } from "vitest";
import { EndlessChallenge } from "../src/pipeline/endless.js";

describe("EndlessChallenge", () => {
  describe("sequential mode", () => {
    it("starts at 01 and cycles 01→02→…→12→01", () => {
      const ch = new EndlessChallenge("sequential", 3.0);
      ch.start(0);
      expect(ch.getCurrent()).toBe("01");
      expect(ch.getCount()).toBe(0);

      const expectedSeq = [
        "02","03","04","05","06","07","08","09","10","11","12","01",
      ];
      let now = 0;
      for (let i = 0; i < expectedSeq.length; i++) {
        const ev = ch.feed(ch.getCurrent(), now);
        now += 0.5;
        expect(ev.status).toBe("endless_advance");
        if (ev.status === "endless_advance") {
          expect(ev.count).toBe(i + 1);
          expect(ev.nextSeal).toBe(expectedSeq[i]);
        }
        expect(ch.getCurrent()).toBe(expectedSeq[i]);
      }
      expect(ch.getCount()).toBe(12);
    });
  });

  describe("random mode", () => {
    it("never returns same seal twice in a row (with deterministic rng)", () => {
      // Force RNG to always return 0.5 → would always pick the middle of pool.
      // After avoid filter, the picked seal alternates as pool shrinks/shifts.
      const ch = new EndlessChallenge("random", 3.0, () => 0.5);
      ch.start(0);
      let now = 0;
      let last = ch.getCurrent();
      for (let i = 0; i < 30; i++) {
        ch.feed(last, now);
        now += 0.1;
        const next = ch.getCurrent();
        expect(next).not.toBe(last);
        last = next;
      }
    });

    it("initial currentSeal is one of the 12 labels", () => {
      const ch = new EndlessChallenge("random", 3.0, () => 0.0);
      const c = ch.getCurrent();
      expect(c).toMatch(/^(0[1-9]|1[0-2])$/);
    });
  });

  describe("feed wrong → gameover with reason 'wrong'", () => {
    it("ends immediately on wrong seal", () => {
      const ch = new EndlessChallenge("sequential", 3.0);
      ch.start(0);
      const ev = ch.feed("99", 0.5);
      expect(ev.status).toBe("endless_gameover");
      if (ev.status === "endless_gameover") {
        expect(ev.reason).toBe("wrong");
        expect(ev.count).toBe(0);
      }
      expect(ch.isOver()).toBe(true);
    });

    it("counts correct ones before wrong", () => {
      const ch = new EndlessChallenge("sequential", 3.0);
      ch.start(0);
      ch.feed("01", 0.5);  // → 02
      ch.feed("02", 1.0);  // → 03
      const ev = ch.feed("99", 1.5);
      expect(ev.status).toBe("endless_gameover");
      if (ev.status === "endless_gameover") {
        expect(ev.reason).toBe("wrong");
        expect(ev.count).toBe(2);
      }
    });
  });

  describe("tick timeout → gameover with reason 'timeout'", () => {
    it("returns gameover after deadline", () => {
      const ch = new EndlessChallenge("sequential", 3.0);
      ch.start(0);
      expect(ch.tick(2.9)).toBeNull();
      const ev = ch.tick(3.1);
      expect(ev).not.toBeNull();
      if (ev) {
        expect(ev.status).toBe("endless_gameover");
        expect(ev.reason).toBe("timeout");
        expect(ev.count).toBe(0);
      }
      expect(ch.isOver()).toBe(true);
    });

    it("deadline resets after each correct feed", () => {
      const ch = new EndlessChallenge("sequential", 3.0);
      ch.start(0);
      ch.feed("01", 2.0);            // success at t=2.0, new deadline=5.0
      expect(ch.tick(4.5)).toBeNull(); // still alive
      const ev = ch.tick(5.5);
      expect(ev?.status).toBe("endless_gameover");
      if (ev?.status === "endless_gameover") expect(ev.reason).toBe("timeout");
    });
  });

  describe("post-gameover behavior", () => {
    it("feed returns ignored after gameover, tick returns null", () => {
      const ch = new EndlessChallenge("sequential", 3.0);
      ch.start(0);
      ch.feed("99", 0.5);  // gameover (wrong)
      expect(ch.feed("01", 1.0).status).toBe("ignored");
      expect(ch.tick(10.0)).toBeNull();
    });
  });

  describe("remainingSec", () => {
    it("returns time until deadline", () => {
      const ch = new EndlessChallenge("sequential", 3.0);
      ch.start(10.0);
      expect(ch.remainingSec(10.0)).toBeCloseTo(3.0);
      expect(ch.remainingSec(11.5)).toBeCloseTo(1.5);
      expect(ch.remainingSec(13.5)).toBe(0);
    });
  });
});
