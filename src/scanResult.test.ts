import { describe, expect, it } from "vitest";
import { kitFrom, normalise } from "./scanResult";

describe("scan results", () => {
  it("uses catalogue figures for known items and clamps estimates", () => {
    const [a, b] = normalise({ food: [{ id: "tuna", count: 3, kcal: 9999 }, { id: "", name: "Mystery tin", group: "bogus", kcal: 1e9, count: 0 }] });
    expect(a).toMatchObject({ cat: "tuna", kcal: 110, count: 3, group: "protein" });
    expect(b).toMatchObject({ cat: null, group: "other", kcal: 5000, count: 1, conf: "medium" });
  });
  it("only ticks kit items a photo can show", () => {
    expect(kitFrom({ kit: ["torch", "water", "nope"] }).map((k) => k.id)).toEqual(["torch"]);
    expect(kitFrom(null)).toEqual([]);
  });
});
