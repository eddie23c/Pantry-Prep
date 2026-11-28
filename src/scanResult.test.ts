import { describe, expect, it } from "vitest";
import { dateNote, fillDates, kitFrom, mergeRepeats, normalise, plausibleBb, type ScannedItem } from "./scanResult";

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

describe("dates across a scan", () => {
  const today = "2026-11-28";
  const item = (o: Partial<ScannedItem>): ScannedItem => ({ ...normalise({ food: [{ id: "", name: "Tin", count: 1 }] })[0], ...o });

  it("says when a date was read on every pack, or on some and assumed for the rest", () => {
    const [a, b, c] = fillDates(normalise({ food: [
      { id: "tuna", count: 2, bb: "2028-03-31", seen: 2 },
      { id: "beans", count: 4, bb: "2027-06-30", seen: 1 },
      { id: "oats", count: 1, bb: "2027-01-31" }, // older reply with no "seen"
    ] }), today);
    expect(a).toMatchObject({ bb: "2028-03-31", from: "read" });
    expect(b).toMatchObject({ bb: "2027-06-30", from: "some" });
    expect(dateNote(b)).toBe("Read on 1 of 4, same date used for the rest");
    expect(c).toMatchObject({ from: "read" });
  });

  it("copies the earliest date from identical packs where one was seen", () => {
    const out = fillDates(normalise({ food: [
      { id: "tuna", pack: "145 g tin", count: 2, bb: "2028-03-31", seen: 2 },
      { id: "tuna", pack: "145 g tin", count: 1, bb: "2027-12-31", seen: 1 },
      { id: "tuna", pack: "145 g tin", count: 3, bb: "", seen: 0 },
      { id: "", name: "Corned Beef", pack: "340g", count: 1, bb: "2029-01-31", seen: 1 },
      { id: "", name: "corned beef", pack: "340 g", count: 2, bb: "" },
    ] }), today);
    expect(out[2]).toMatchObject({ bb: "2027-12-31", from: "match" });
    expect(out[4]).toMatchObject({ bb: "2029-01-31", from: "match" });
  });

  it("falls back to a shelf-life estimate it shows but does not save as a date", () => {
    const [x] = fillDates([item({ cat: null, name: "Rice", kind: "rice", count: 2, seen: 0 })], today);
    expect(x.bb).toBeUndefined();
    expect(x).toMatchObject({ from: "estimate", guess: "2027-08-28" });
  });

  it("folds one pack seen in two video frames into one entry without double counting", () => {
    const out = mergeRepeats(normalise({ food: [
      { id: "tuna", pack: "145 g tin", count: 3, bb: "2028-03-31", seen: 1, confidence: "high" },
      { id: "tuna", pack: "145 g tin", count: 2, bb: "2028-03-31", seen: 2, confidence: "low" },
      { id: "tuna", pack: "145 g tin", count: 1, bb: "2027-01-31", seen: 1 },
    ] }));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ count: 3, seen: 2, conf: "low" });
  });
});
