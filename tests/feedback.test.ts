import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");

function parsePage(): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function styleRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("feedback link", () => {
  it("opens the feedback form from a persistent button", () => {
    const document = parsePage();
    const link = document.querySelector<HTMLAnchorElement>("#feedback");

    expect(link).not.toBeNull();
    expect(link?.textContent?.trim()).toBe("Feedback");
    expect(link?.href).toBe("https://forms.gle/sC6cUzThGp7LC7pQ9");
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toContain("noopener");
  });

  it("uses mobile-safe top-right placement without colliding with mute", () => {
    const feedbackRule = styleRule("#feedback");
    const muteRule = styleRule("#mute");

    expect(feedbackRule).toContain("position: fixed");
    expect(feedbackRule).toContain("top: calc(12px + env(safe-area-inset-top))");
    expect(feedbackRule).toContain("right: calc(12px + env(safe-area-inset-right))");
    expect(feedbackRule).toContain("min-height: 44px");
    expect(muteRule).toContain("top: calc(64px + env(safe-area-inset-top))");
  });
});
