import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildMuteToggle } from "../src/ui/mute.js";

describe("buildMuteToggle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("default state is unmuted, calls back with false", () => {
    const cb = vi.fn();
    buildMuteToggle(document.body, cb);
    expect(cb).toHaveBeenLastCalledWith(false);
  });

  it("toggling persists to localStorage", () => {
    const cb = vi.fn();
    const t = buildMuteToggle(document.body, cb);
    document.querySelector("#mute")!.dispatchEvent(new MouseEvent("click"));
    expect(t.isMuted()).toBe(true);
    expect(localStorage.getItem("naruto_seal_muted")).toBe("1");
    expect(cb).toHaveBeenLastCalledWith(true);
  });

  it("respects existing localStorage value on init", () => {
    localStorage.setItem("naruto_seal_muted", "1");
    const cb = vi.fn();
    const t = buildMuteToggle(document.body, cb);
    expect(t.isMuted()).toBe(true);
    expect(cb).toHaveBeenLastCalledWith(true);
  });
});
