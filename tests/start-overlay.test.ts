import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");

describe("start overlay pose guide", () => {
  it("shows false and correct hand-position examples before camera loading", () => {
    expect(html).toContain('id="overlay__pose-guide"');
    expect(html).toContain('src="/assets/effects/mouse_hands_false.png"');
    expect(html).toContain('src="/assets/effects/chest_hands_correct.png"');
    expect(html).toContain('aria-label="Incorrect hand position"');
    expect(html).toContain('aria-label="Correct hand position"');
  });

  it("uses desktop comparison order and mobile correct-first order", () => {
    const falseIndex = html.indexOf('overlay__pose-card overlay__pose-card--false');
    const correctIndex = html.indexOf('overlay__pose-card overlay__pose-card--correct');
    expect(falseIndex).toBeGreaterThan(-1);
    expect(correctIndex).toBeGreaterThan(-1);
    expect(falseIndex).toBeLessThan(correctIndex);

    expect(html).toContain(".overlay__pose-card--correct { order: -1;");
  });
});
