import { describe, expect, it } from "vitest";
import { kitFrom, normalise, plausibleBb } from "./scanResult";

describe("scan results", () => {
  it("uses catalogue figures for known items and clamps estimates", () => {
    const [a, b] = normalise({ food: [{ id: "tuna", count: 3, kcal: 9999 }, { id: "", name: "Mystery tin", group: "bogus", kcal: 1e9, count: 0 }] });
    expect(a).toMatchObject({ cat: "tuna", kcal: 110, count: 3, group: "protein" });
    expect(b).toMatchObject({ cat: null, group: "other", kcal: 5000, count: 1, conf: "medium" });
  });
  it("keeps a best-before date read off the pack, and drops unreadable or unlikely ones", () => {
    const now = new Date(2026, 10, 27);
    expect(plausibleBb("2028-03-31", now)).toBe(true);
    expect(plausibleBb("2041-01-01", now)).toBe(false);
    expect(plausibleBb("2028-02-30", now)).toBe(false);
    expect(plausibleBb("", now)).toBe(false);
    const [a, b] = normalise({ food: [{ id: "tuna", bb: "2028-03-31" }, { id: "oats", bb: "" }] });
    expect(a.bb).toBe("2028-03-31");
    expect(b.bb).toBeUndefined();
  });
  it("only ticks kit items a photo can show", () => {
    expect(kitFrom({ kit: ["torch", "water", "nope"] }).map((k) => k.id)).toEqual(["torch"]);
    expect(kitFrom(null)).toEqual([]);
  });
});
