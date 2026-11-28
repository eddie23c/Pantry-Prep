import { describe, expect, it } from "vitest";
import { candidateTimes, sharpness } from "./frames";

describe("video frames", () => {
  it("spreads the frames across the whole video and keeps away from the very ends", () => {
    const t = candidateTimes(15, 6, 3);
    expect(t).toHaveLength(6);
    expect(t.every((r) => r.length === 3)).toBe(true);
    const flat = t.flat();
    expect(flat[0]).toBeGreaterThan(0.3);
    expect(flat[flat.length - 1]).toBeLessThan(14.7);
    expect([...flat].sort((a, b) => a - b)).toEqual(flat);
  });
  it("takes fewer frames from a very short clip", () => {
    expect(candidateTimes(1.2, 6)).toHaveLength(2);
    expect(candidateTimes(NaN, 6)).toEqual([[0]]);
  });
  it("scores a sharp edge above a smooth blur", () => {
    const w = 8, h = 8;
    const sharp = Array.from({ length: w * h }, (_, i) => (i % w < 4 ? 0 : 255));
    const blur = Array.from({ length: w * h }, (_, i) => (i % w) * 32);
    expect(sharpness(sharp, w, h)).toBeGreaterThan(sharpness(blur, w, h));
  });
});
