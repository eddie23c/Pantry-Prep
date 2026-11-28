import { describe, expect, it } from "vitest";
import { addDays, addMonths, checkReminderIcs, daysBetween, expiring, expiryPhrase, expiryStatus, formatDate, isIsoDate, rotatePlan, KIT_CHECK_DAYS, kitCheckDue, nextCheck, shelfMonths, todayIso, useBy } from "./dates";
import { fromCat } from "./storage";

const today = "2026-11-26";
const dated = (id: string, bb?: string, added?: string) => ({ ...fromCat(id, 1), bb, added });

describe("dates", () => {
  it("accepts only real calendar days", () => {
    expect(isIsoDate("2027-02-28")).toBe(true);
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("27-2-1")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
  it("counts whole days, across a clock change", () => {
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
    expect(daysBetween(today, "2026-11-25")).toBe(-1);
  });
  it("formats today in local time", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
  it("formats dates the UK way", () => {
    expect(formatDate("2027-03-14")).toBe("14 Mar 2027");
  });
});

describe("best before", () => {
  it("flags expired, soon and fine", () => {
    expect(expiryStatus("2026-11-25", today)).toBe("expired");
    expect(expiryStatus("2026-11-26", today)).toBe("soon");
    expect(expiryStatus("2026-12-26", today)).toBe("soon");
    expect(expiryStatus("2026-12-27", today)).toBe("ok");
    expect(expiryStatus(undefined, today)).toBeNull();
  });
  it("lists the soonest first and skips undated items", () => {
    const e = expiring([dated("tuna", "2026-12-20"), dated("oats"), dated("pb", "2026-12-01"), dated("raisins", "2026-01-01")], today);
    expect(e.expired.map((x) => x.item.cat)).toEqual(["raisins"]);
    expect(e.soon.map((x) => x.item.cat)).toEqual(["pb", "tuna"]);
  });
  it("includes estimated dates, marked as estimates", () => {
    // Oats keep about 9 months: added 2026-03-10 means about 2026-12-10, so soon.
    const e = expiring([dated("oats", undefined, "2026-03-10"), dated("tuna", undefined, "2026-03-10")], today);
    expect(e.soon).toEqual([expect.objectContaining({ date: "2026-12-10", estimated: true })]);
    expect(e.soon[0].item.cat).toBe("oats");
  });
  it("describes the date in words", () => {
    expect(expiryPhrase("2026-11-27", today)).toBe("Best before tomorrow");
    expect(expiryPhrase("2026-11-20", today)).toBe("Past best before by 6 days");
    expect(expiryPhrase("2027-05-01", today)).toBe("Best before 1 May 2027");
    expect(expiryPhrase("2026-12-06", today, true)).toBe("About 10 days left (estimated)");
    expect(expiryPhrase("2026-11-01", today, true)).toMatch(/^Probably past its best/);
  });
});

describe("use this month", () => {
  it("groups items due in the next 30 days by week, leaving out empty bands and later dates", () => {
    const plan = rotatePlan([dated("tuna", "2026-11-20"), dated("oats", "2026-11-30"), dated("pb", "2026-12-20"), dated("raisins", "2027-06-01")], today);
    expect(plan.map((g) => [g.id, g.items.map((d) => d.item.cat)])).toEqual([["past", ["tuna"]], ["week", ["oats"]], ["month", ["pb"]]]);
  });
});

describe("estimated best before", () => {
  it("prefers the date from the pack", () => {
    expect(useBy(dated("tuna", "2028-01-31", "2026-11-01"))).toEqual({ date: "2028-01-31", estimated: false });
  });
  it("estimates from the kind of food and the day it was added", () => {
    expect(shelfMonths({ kind: "fish" })).toBe(24);
    expect(shelfMonths({ kind: null })).toBe(6);
    expect(useBy(dated("tuna", undefined, "2026-11-27"))).toEqual({ date: "2028-11-27", estimated: true });
  });
  it("has nothing to go on without either", () => {
    expect(useBy(dated("tuna"))).toBeNull();
  });
  it("adds months without spilling into the next month", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2026-11-27", 18)).toBe("2028-05-27");
  });
});

describe("kit check", () => {
  it("is due when never done or 90 days old", () => {
    expect(kitCheckDue(undefined, today)).toBe(true);
    expect(kitCheckDue("2026-09-01", today)).toBe(false);
    expect(kitCheckDue("2026-08-28", today)).toBe(true);
  });
});

describe("check reminder", () => {
  it("is due KIT_CHECK_DAYS after the last check, or from today", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(nextCheck("2026-11-27", "2026-12-01")).toBe(addDays("2026-11-27", KIT_CHECK_DAYS));
    expect(nextCheck(undefined, "2026-12-01")).toBe(addDays("2026-12-01", KIT_CHECK_DAYS));
  });
  it("makes an all-day calendar event with CRLF lines", () => {
    const ics = checkReminderIcs("2027-02-25", new Date("2026-11-27T10:00:00Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20270225\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20270226\r\n");
    expect(ics).toContain("DTSTAMP:20261127T100000Z\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
});
