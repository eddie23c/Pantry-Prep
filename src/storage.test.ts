import { describe, expect, it } from "vitest";
import { defaultState, fromBackup, sanitise, toBackup } from "./storage";

describe("backup", () => {
  it("round-trips a store", () => {
    const s = defaultState();
    expect(fromBackup(toBackup(s))).toEqual(s);
  });
  it("rejects files that are not Pantry Prep backups", () => {
    expect(fromBackup("{}")).toBeNull();
    expect(fromBackup("not json")).toBeNull();
  });
});

describe("sanitise", () => {
  it("clamps bad numbers and drops junk items", () => {
    const s = sanitise({ house: { adults: -5, children: "x", days: 99 }, items: [null, { name: "<b>Tins</b>", count: 1e9, group: "bogus" }] })!;
    expect(s.house.adults).toBe(1);
    expect(s.house.days).toBe(30);
    expect(s.items).toHaveLength(1);
    expect(s.items[0].count).toBe(999);
    expect(s.items[0].group).toBe("other");
  });
});

describe("dates in storage", () => {
  it("keeps valid best-before and kit-check dates and drops bad ones", () => {
    const s = sanitise({ house: {}, kitChecked: "2026-11-01", items: [{ name: "A", bb: "2027-01-31" }, { name: "B", bb: "2027-02-31" }, { name: "C", bb: "soon" }] })!;
    expect(s.kitChecked).toBe("2026-11-01");
    expect(s.items.map((i) => i.bb)).toEqual(["2027-01-31", undefined, undefined]);
    expect(sanitise({ house: {}, items: [], kitChecked: "x" })!.kitChecked).toBeUndefined();
  });
});
