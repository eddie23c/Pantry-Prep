import { describe, expect, it } from "vitest";
import { daysBetween, expiring, expiryPhrase, expiryStatus, formatDate, isIsoDate, kitCheckDue, todayIso } from "./dates";
import { fromCat } from "./storage";

const today = "2026-11-26";
const dated = (id: string, bb?: string) => ({ ...fromCat(id, 1), bb });

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
    expect(e.expired.map((x) => x.cat)).toEqual(["raisins"]);
    expect(e.soon.map((x) => x.cat)).toEqual(["pb", "tuna"]);
  });
  it("describes the date in words", () => {
    expect(expiryPhrase("2026-11-27", today)).toBe("Best before tomorrow");
    expect(expiryPhrase("2026-11-20", today)).toBe("Past best before by 6 days");
    expect(expiryPhrase("2027-05-01", today)).toBe("Best before 1 May 2027");
  });
});

describe("kit check", () => {
  it("is due when never done or 90 days old", () => {
    expect(kitCheckDue(undefined, today)).toBe(true);
    expect(kitCheckDue("2026-09-01", today)).toBe(false);
    expect(kitCheckDue("2026-08-28", today)).toBe(true);
  });
});
