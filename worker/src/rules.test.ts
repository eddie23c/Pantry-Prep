import { describe, expect, it } from "vitest";
import { allowedOrigin, codeMatches, decideTake, parseScanRequest, type Limit } from "./rules";

const jpeg = "/9j/4AAQSkZJRg";

describe("scan worker rules", () => {
  it("accepts a good request and rejects bad ones", () => {
    expect(parseScanRequest({ device: "abcd-1234", images: [jpeg], code: " Beta " }, 3)).toEqual({ device: "abcd-1234", code: "Beta", images: [jpeg] });
    expect(parseScanRequest({ device: "x", images: [jpeg] }, 3)).toMatchObject({ status: 400 });
    expect(parseScanRequest({ device: "abcd-1234", images: [] }, 3)).toMatchObject({ status: 400 });
    expect(parseScanRequest({ device: "abcd-1234", images: ["iVBOR"] }, 3)).toMatchObject({ message: "Photos must be JPEG" });
    expect(parseScanRequest({ device: "abcd-1234", images: [jpeg, jpeg, jpeg, jpeg] }, 3)).toMatchObject({ error: "too_big" });
    expect(parseScanRequest(null, 3)).toMatchObject({ status: 400 });
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
