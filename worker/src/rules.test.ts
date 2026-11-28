import { describe, expect, it } from "vitest";
import { allowedOrigin, codeMatches, compareModels, costUsd, decideTake, parseScanRequest, photoCost, type Limit } from "./rules";

const jpeg = "/9j/4AAQSkZJRg";

describe("scan worker rules", () => {
  it("accepts a good request and rejects bad ones", () => {
    expect(parseScanRequest({ device: "abcd-1234", images: [jpeg], code: " Beta " }, 3)).toEqual({ device: "abcd-1234", code: "Beta", images: [jpeg], video: false });
    expect(parseScanRequest({ device: "x", images: [jpeg] }, 3)).toMatchObject({ status: 400 });
    expect(parseScanRequest({ device: "abcd-1234", images: [] }, 3)).toMatchObject({ status: 400 });
    expect(parseScanRequest({ device: "abcd-1234", images: ["iVBOR"] }, 3)).toMatchObject({ message: "Photos must be JPEG" });
    expect(parseScanRequest({ device: "abcd-1234", images: [jpeg, jpeg, jpeg, jpeg] }, 3)).toMatchObject({ error: "too_big" });
    expect(parseScanRequest(null, 3)).toMatchObject({ status: 400 });
  });

  it("takes more frames from a video scan, and charges one photo per two frames", () => {
    const six = Array(6).fill(jpeg);
    const r = parseScanRequest({ device: "abcd-1234", images: six, video: true }, 3, 6);
    expect(r).toMatchObject({ video: true, images: six });
    expect(parseScanRequest({ device: "abcd-1234", images: [...six, jpeg], video: true }, 3, 6)).toMatchObject({ error: "too_big" });
    expect(parseScanRequest({ device: "abcd-1234", images: six }, 3, 6)).toMatchObject({ error: "too_big" });
    expect(photoCost({ images: six, video: true })).toBe(3);
    expect(photoCost({ images: [jpeg, jpeg, jpeg, jpeg, jpeg], video: true })).toBe(3);
    expect(photoCost({ images: [jpeg, jpeg], video: false })).toBe(2);
  });

  it("only lets listed sites call it", () => {
    const list = "https://eddie23c.github.io, http://localhost:5173";
    expect(allowedOrigin("https://eddie23c.github.io", list)).toBe("https://eddie23c.github.io");
    expect(allowedOrigin("https://evil.example", list)).toBeNull();
    expect(allowedOrigin(null, list)).toBeNull();
  });

  it("matches invite codes without caring about case or spaces", () => {
    expect(codeMatches(" pantry ", "PANTRY")).toBe(true);
    expect(codeMatches("pantr", "pantry")).toBe(false);
  });

  it("stops at whichever daily limit runs out first", () => {
    const limits: Limit[] = [
      { key: "device:a", max: 12, error: "daily_limit" },
      { key: "ip:1", max: 36, error: "daily_limit" },
      { key: "total", max: 300, error: "busy" },
    ];
    expect(decideTake({}, limits, 3)).toEqual({ ok: true, remaining: 9 });
    expect(decideTake({ "device:a": 10 }, limits, 3)).toEqual({ ok: false, error: "daily_limit", remaining: 2 });
    expect(decideTake({ total: 299 }, limits, 2)).toEqual({ ok: false, error: "busy", remaining: 12 });
  });
});

describe("compare scans", () => {
  it("prices a scan per model", () => {
    expect(costUsd("claude-haiku-5-5", 3300, 3000)).toBeCloseTo(0.00183, 5);
    expect(costUsd("claude-opus-5-5", 1_000_000, 0)).toBe(4);
    expect(costUsd("mystery", 1, 1)).toBeNull();
  });
  it("reads the model list safely", () => {
    expect(compareModels(undefined)).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]);
    expect(compareModels("claude-haiku-5-5, claude-haiku-5-5, bad model, claude-fable-5-2")).toEqual(["claude-haiku-5-5", "claude-fable-5-2"]);
  });
});
