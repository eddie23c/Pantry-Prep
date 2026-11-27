import { describe, expect, it } from "vitest";
import type { AppState } from "../calc";
import { defaultState } from "../storage";
import { MAX_REMINDERS, reminderPlan } from "./reminders";

function state(items: { name: string; bb?: string }[], extra: Partial<AppState> = {}): AppState {
  const s = defaultState();
  s.example = false;
  s.items = items.map((it, i) => ({ ...s.items[0], uid: "u" + i, ...it }));
  return { ...s, ...extra };
}

describe("reminderPlan", () => {
  it("does nothing for the example store", () => {
    const s = state([{ name: "Beans", bb: "2027-06-01" }]);
    s.example = true;
    expect(reminderPlan(s, "2027-01-01")).toEqual([]);
  });

  it("reminds 30 days before a best-before date, grouping items with the same date", () => {
    const r = reminderPlan(state([{ name: "Beans", bb: "2027-06-01" }, { name: "Rice", bb: "2027-06-01" }, { name: "Oats", bb: "2027-07-01" }]), "2027-01-01");
    expect(r.map((x) => x.day)).toEqual(["2027-05-02", "2027-06-01"]);
    expect(r[0].body).toMatch(/^2 items .* reach best before in 30 days/);
    expect(r[1].body).toMatch(/^Oats .* reaches/);
  });

  it("brings a reminder forward to tomorrow when the warning day has passed, and skips past dates", () => {
    const r = reminderPlan(state([{ name: "Beans", bb: "2027-01-10" }, { name: "Old", bb: "2026-12-01" }, { name: "Undated" }]), "2027-01-01");
    expect(r).toHaveLength(1);
    expect(r[0].day).toBe("2027-01-02");
    expect(r[0].body).toContain("in 8 days");
  });

  it("schedules the kit check from the last check", () => {
    const r = reminderPlan(state([], { kitChecked: "2027-01-01" }), "2027-01-05");
    expect(r).toEqual([expect.objectContaining({ id: 1, day: "2027-04-01" })]);
  });

  it("gives each date a stable id and caps the count", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ name: "x" + i, bb: `2028-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}` }));
    const a = reminderPlan(state(items), "2027-01-01");
    const b = reminderPlan(state(items), "2027-01-01");
    expect(a.length).toBeLessThanOrEqual(MAX_REMINDERS);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
  });
});
