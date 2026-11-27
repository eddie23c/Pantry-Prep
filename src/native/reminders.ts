// Which phone notifications to schedule in the iPhone app. Pure function, tested in reminders.test.ts.
// Reminders are worked out on the phone from the saved store: nothing is sent anywhere.
import type { AppState } from "../calc";
import { daysBetween, isIsoDate, KIT_CHECK_DAYS, SOON_DAYS } from "../dates";

export interface Reminder {
  /** Stable number per reminder, so rescheduling replaces rather than duplicates. */
  id: number;
  title: string;
  body: string;
  /** Calendar day to show it, "YYYY-MM-DD". Shown at 10 am local time. */
  day: string;
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

  // One reminder per best-before date, SOON_DAYS ahead (or today+1 if that has passed but the date hasn't).
  const byDate = new Map<string, string[]>();
  for (const it of state.items) {
    if (!it.bb || !isIsoDate(it.bb) || daysBetween(today, it.bb) < 1) continue;
    const list = byDate.get(it.bb) || [];
    list.push(it.name);
    byDate.set(it.bb, list);
  }
  for (const [bb, names] of [...byDate].sort(([a], [b]) => (a < b ? -1 : 1))) {
    let day = addDays(bb, -SOON_DAYS);
    if (daysBetween(today, day) < 1) day = addDays(today, 1);
    const left = daysBetween(day, bb);
    const what = names.length === 1 ? names[0] : `${names.length} items`;
    out.push({
      id: idFor(bb),
      title: "Time to use or swap",
      body: `${what} in your store ${names.length === 1 ? "reaches" : "reach"} best before in ${left} ${left === 1 ? "day" : "days"}. Eat it and replace it to keep your three days topped up.`,
      day,
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
