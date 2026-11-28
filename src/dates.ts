// Best-before dates and "last checked" dates. Pure functions, tested in dates.test.ts.
// Dates are stored as plain calendar days ("2027-03-14") so time zones never shift them.
import type { StoreItem } from "./calc";

/** Warn this many days before a best-before date. */
export const SOON_DAYS = 30;
/** Ask people to re-check their kit after this many days. */
export const KIT_CHECK_DAYS = 90;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !ISO.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today as a calendar day in the person's own time zone. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from));
}

export type ExpiryStatus = "expired" | "soon" | "ok";

export function expiryStatus(bb: string | undefined, today: string): ExpiryStatus | null {
  if (!bb || !isIsoDate(bb)) return null;
  const left = daysBetween(today, bb);
  return left < 0 ? "expired" : left <= SOON_DAYS ? "soon" : "ok";
}

/**
 * Typical months of shelf life left on a pack bought from a UK supermarket, by kind.
 * Deliberately on the short side, so an estimate warns early rather than late.
 */
export const SHELF_MONTHS: Record<string, number> = {
  fish: 24, meat: 24, beans: 18, pulses: 24, veg: 18, tomatoes: 18, potatoes: 18, fruit: 18, soup: 18,
  driedfruit: 9, nuts: 6, nutbutter: 9, crackers: 6, oats: 9, cereal: 6, wraps: 2, pasta: 18, rice: 9,
  noodles: 9, milk: 6, pudding: 12, oil: 12, honey: 24, snack: 6, water: 12, juice: 6,
};
/** For items with no known kind. */
export const SHELF_DEFAULT_MONTHS = 6;

export function shelfMonths(it: Pick<StoreItem, "kind">): number {
  return (it.kind && SHELF_MONTHS[it.kind]) || SHELF_DEFAULT_MONTHS;
}

/** The calendar day `months` after `iso`, kept inside the month (31 Jan + 1 month = 28 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  const dt = new Date(Date.UTC(y, m - 1 + months, Math.min(d, last)));
  return dt.toISOString().slice(0, 10);
}

export interface UseBy {
  date: string;
  /** True when worked out from the kind of food and the day it was added, not read off the pack. */
  estimated: boolean;
}

/** When an item should be eaten and replaced: its own best-before date, or an estimate. */
export function useBy(it: Pick<StoreItem, "bb" | "added" | "kind">): UseBy | null {
  if (it.bb && isIsoDate(it.bb)) return { date: it.bb, estimated: false };
  if (it.added && isIsoDate(it.added)) return { date: addMonths(it.added, shelfMonths(it)), estimated: true };
  return null;
}

export interface Due extends UseBy {
  item: StoreItem;
  status: ExpiryStatus;
}

/** Items past or near their best-before date (real or estimated), soonest first. */
export function expiring(items: StoreItem[], today: string) {
  const due: Due[] = items
    .flatMap((item): Due[] => {
      const u = useBy(item);
      const status = u && expiryStatus(u.date, today);
      return u && status && status !== "ok" ? [{ item, ...u, status }] : [];
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    expired: due.filter((d) => d.status === "expired"),
    soon: due.filter((d) => d.status === "soon"),
  };
}

export interface RotateGroup {
  id: "past" | "week" | "next" | "month";
  label: string;
  items: Due[];
}

/** Everything to eat and rotate out in the next SOON_DAYS, in time bands, soonest first. Empty bands are left out. */
export function rotatePlan(items: StoreItem[], today: string): RotateGroup[] {
  const e = expiring(items, today);
  const left = (d: Due) => daysBetween(today, d.date);
  const groups: RotateGroup[] = [
    { id: "past", label: "Past its date", items: e.expired },
    { id: "week", label: "This week", items: e.soon.filter((d) => left(d) <= 7) },
    { id: "next", label: "Next week", items: e.soon.filter((d) => left(d) > 7 && left(d) <= 14) },
    { id: "month", label: "Later this month", items: e.soon.filter((d) => left(d) > 14) },
  ];
  return groups.filter((g) => g.items.length);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "14 Mar 2027". */
export function formatDate(iso: string): string {
  if (!isIsoDate(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Short human phrase for how far away a best-before date is. */
export function expiryPhrase(bb: string, today: string, estimated = false): string {
  const left = daysBetween(today, bb);
  if (estimated) {
    if (left < 0) return "Probably past its best. No date on record";
    if (left <= SOON_DAYS) return `About ${left} ${left === 1 ? "day" : "days"} left (estimated)`;
    return `Best before about ${formatDate(bb)} (estimated)`;
  }
  if (left < -1) return `Past best before by ${-left} days`;
  if (left === -1) return "Past best before since yesterday";
  if (left === 0) return "Best before today";
  if (left === 1) return "Best before tomorrow";
  if (left <= SOON_DAYS) return `Best before in ${left} days`;
  return `Best before ${formatDate(bb)}`;
}

/** True when the kit has never been checked, or not for KIT_CHECK_DAYS. */
export function kitCheckDue(last: string | undefined, today: string): boolean {
  return !last || !isIsoDate(last) || daysBetween(last, today) >= KIT_CHECK_DAYS;
}

/** The calendar day `days` after `iso`. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** When the next kit and food check is due: KIT_CHECK_DAYS after the last one, or from today. */
export function nextCheck(last: string | undefined, today: string): string {
  return addDays(last && isIsoDate(last) ? last : today, KIT_CHECK_DAYS);
}

/**
 * A one-day calendar event (.ics) for the next check, with an alert that morning.
 * Opening the file adds it to the phone's own calendar, so no server or push is needed.
 */
export function checkReminderIcs(due: string, stamp: Date = new Date()): string {
  const compact = (iso: string) => iso.replace(/-/g, "");
  const utc = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pantry Prep//Store check//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:pantry-prep-check-${compact(due)}@pantry-prep`,
    `DTSTAMP:${utc}`,
    `DTSTART;VALUE=DATE:${compact(due)}`,
    `DTEND;VALUE=DATE:${compact(addDays(due, 1))}`,
    "SUMMARY:Check your Pantry Prep store",
    "DESCRIPTION:Check best-before dates and eat and replace anything close. Test torches and radios\\, swap old batteries and medicines\\, and charge the power bank.",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Check your emergency food and kit", "TRIGGER:PT9H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}
