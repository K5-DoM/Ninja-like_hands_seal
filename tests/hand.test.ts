import { describe, expect, it } from "vitest";
import { squareBoxWithin } from "../src/pipeline/hand.js";

describe("squareBoxWithin", () => {
  it("centered box fits image", () => {
    const box = squareBoxWithin(200, 200, 100, 400, 400);
    expect(box).not.toBeNull();
    const [x0, y0, x1, y1] = box!;
    expect(x1 - x0).toBe(y1 - y0);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(y0).toBeGreaterThanOrEqual(0);
    expect(x1).toBeLessThanOrEqual(400);
    expect(y1).toBeLessThanOrEqual(400);
  });

  it("top-left corner shifts inward to stay square", () => {
    const box = squareBoxWithin(10, 10, 100, 400, 400);
    expect(box).not.toBeNull();
    const [x0, y0, x1, y1] = box!;
    expect(x1 - x0).toBe(y1 - y0);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(y0).toBeGreaterThanOrEqual(0);
    expect(x1).toBeLessThanOrEqual(400);
    expect(y1).toBeLessThanOrEqual(400);
  });

  it("bottom-right corner shifts inward to stay square", () => {
    const box = squareBoxWithin(390, 390, 100, 400, 400);
    expect(box).not.toBeNull();
    const [x0, y0, x1, y1] = box!;
    expect(x1 - x0).toBe(y1 - y0);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(y0).toBeGreaterThanOrEqual(0);
    expect(x1).toBeLessThanOrEqual(400);
    expect(y1).toBeLessThanOrEqual(400);
  });

  it("side larger than smallest image dim is capped", () => {
    const box = squareBoxWithin(200, 150, 500, 400, 300);
    expect(box).not.toBeNull();
    const [x0, y0, x1, y1] = box!;
    expect(x1 - x0).toBe(y1 - y0);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(y0).toBeGreaterThanOrEqual(0);
    expect(x1).toBeLessThanOrEqual(400);
    expect(y1).toBeLessThanOrEqual(300);
  });

  it("zero side returns null", () => {
    expect(squareBoxWithin(100, 100, 0, 400, 400)).toBeNull();
  });

  it("negative side returns null", () => {
    expect(squareBoxWithin(100, 100, -10, 400, 400)).toBeNull();
  });

  it.each([
    [30, 200, 150, 400, 400],   // near left edge
    [370, 200, 150, 400, 400],  // near right edge
    [200, 30, 150, 400, 400],   // near top edge
    [200, 370, 150, 400, 400],  // near bottom edge
    [30, 30, 150, 400, 400],    // near top-left corner
  ] as const)("cx=%i cy=%i side=%i stays square and in bounds", (cx, cy, side, W, H) => {
    const box = squareBoxWithin(cx, cy, side, W, H);
    expect(box).not.toBeNull();
    const [x0, y0, x1, y1] = box!;
    expect(x1 - x0).toBe(y1 - y0);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(y0).toBeGreaterThanOrEqual(0);
    expect(x1).toBeLessThanOrEqual(W);
    expect(y1).toBeLessThanOrEqual(H);
  });
});
