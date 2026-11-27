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

/** Items past or near their best-before date, soonest first. */
export function expiring(items: StoreItem[], today: string) {
  const dated = items
    .filter((it) => it.bb && isIsoDate(it.bb))
    .sort((a, b) => (a.bb! < b.bb! ? -1 : a.bb! > b.bb! ? 1 : 0));
  return {
    expired: dated.filter((it) => expiryStatus(it.bb, today) === "expired"),
    soon: dated.filter((it) => expiryStatus(it.bb, today) === "soon"),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "14 Mar 2027". */
export function formatDate(iso: string): string {
  if (!isIsoDate(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Short human phrase for how far away a best-before date is. */
export function expiryPhrase(bb: string, today: string): string {
  const left = daysBetween(today, bb);
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
