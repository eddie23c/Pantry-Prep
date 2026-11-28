// Which reminders to give: phone notifications in the iPhone app, and a calendar file on the web.
// Pure functions, tested in reminders.test.ts. Worked out on the phone from the saved store: nothing is sent anywhere.
import type { AppState } from "../calc";
import { daysBetween, formatDate, isIsoDate, KIT_CHECK_DAYS, SOON_DAYS, useBy } from "../dates";

export interface Reminder {
  /** Stable number per reminder, so rescheduling replaces rather than duplicates. */
  id: number;
  title: string;
  body: string;
  /** Calendar day to show it, "YYYY-MM-DD". Shown at 10 am local time. */
  day: string;
  /** The best-before date it warns about. Absent for the kit check. */
  bb?: string;
}

/** iOS keeps at most 64 pending notifications per app. Leave headroom. */
export const MAX_REMINDERS = 40;
const KIT_ID = 1;

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function idFor(day: string): number {
  return 1000 + Number(day.replace(/-/g, "")) % 100000000;
}

export function reminderPlan(state: AppState, today: string): Reminder[] {
  if (state.example) return [];
  const out: Reminder[] = [];

  // One reminder per best-before date (real or estimated), SOON_DAYS ahead, or tomorrow if that has passed but the date hasn't.
  const byDate = new Map<string, { names: string[]; estimated: boolean }>();
  for (const it of state.items) {
    const u = useBy(it);
    if (!u || daysBetween(today, u.date) < 1) continue;
    const g = byDate.get(u.date) || { names: [], estimated: true };
    g.names.push(it.name);
    g.estimated &&= u.estimated;
    byDate.set(u.date, g);
  }
  for (const [bb, { names, estimated }] of [...byDate].sort(([a], [b]) => (a < b ? -1 : 1))) {
    let day = addDays(bb, -SOON_DAYS);
    if (daysBetween(today, day) < 1) day = addDays(today, 1);
    const left = daysBetween(day, bb);
    const what = names.length === 1 ? names[0] : names.length <= 3 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : `${names.length} items`;
    const when = `${estimated ? "probably " : ""}${names.length === 1 ? "reaches" : "reach"} best before in ${left} ${left === 1 ? "day" : "days"}${estimated ? " (estimated, so check the pack)" : ""}`;
    out.push({
      id: idFor(bb),
      title: "Time to use or swap",
      body: `${what} in your store ${when}. Eat it and replace it to keep your store topped up.`,
      day,
      bb,
    });
  }

  // Kit check, KIT_CHECK_DAYS after it was last confirmed.
  if (state.kitChecked && isIsoDate(state.kitChecked)) {
    let day = addDays(state.kitChecked, KIT_CHECK_DAYS);
    if (daysBetween(today, day) < 1) day = addDays(today, 1);
    out.push({ id: KIT_ID, title: "Check your Be Ready kit", body: "Take a few minutes to check your torch, radio, batteries and water.", day });
  }

  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)).slice(0, MAX_REMINDERS);
}

/** Escapes text for an iCalendar value. */
const icsText = (t: string) => t.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");

/** Folds an iCalendar line to 75 characters, as the format asks. */
function fold(line: string): string {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 74) out.push((i ? " " : "") + line.slice(i, i + 74));
  return out.join("\r\n");
}

/**
 * A calendar file (.ics) with one all-day event per use-and-replace reminder, each alerting that morning.
 * It is how the website reminds people without a server: opening the file adds the events to the phone's
 * own calendar. Each event keeps the same UID for the same date, so adding the file again updates them.
 */
export function useByIcs(plan: Reminder[], stamp: Date = new Date()): string {
  const compact = (iso: string) => iso.replace(/-/g, "");
  const utc = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = plan.filter((r) => r.bb).flatMap((r) => [
    "BEGIN:VEVENT",
    `UID:pantry-prep-useby-${compact(r.bb!)}@pantry-prep`,
    `DTSTAMP:${utc}`,
    `DTSTART;VALUE=DATE:${compact(r.day)}`,
    `DTEND;VALUE=DATE:${compact(addDays(r.day, 1))}`,
    `SUMMARY:${icsText("Pantry Prep: use and replace")}`,
    `DESCRIPTION:${icsText(`${r.body} Best before ${formatDate(r.bb!)}.`)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(r.title)}`, "TRIGGER:PT9H", "END:VALARM",
    "END:VEVENT",
  ]);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pantry Prep//Use and replace//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...events, "END:VCALENDAR", ""]
    .map(fold).join("\r\n");
}
