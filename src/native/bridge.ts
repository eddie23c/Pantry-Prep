// Everything the iPhone app does beyond the website: native splash and status bar, haptics,
// saving and printing through iOS sheets, reminders, and a second copy of the store in the
// app's own settings storage (iOS can clear a web view's storage when the phone is very full).
// Only loaded inside the app, so the website never downloads it.
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { registerPlugin } from "@capacitor/core";
import type { AppState } from "../calc";
import { todayIso } from "../dates";
import { reminderPlan } from "./reminders";

const STORE_KEY = "pantry-prep-v1"; // same key the website uses in localStorage (src/storage.ts)

interface PrintPlugin { printHtml(o: { html: string; name?: string }): Promise<{ printed: boolean }> }
const Print = registerPlugin<PrintPlugin>("Print");

/** Before the first draw: if the web view lost its storage, put the app's copy back. */
export async function restoreStore(): Promise<void> {
  try {
    if (localStorage.getItem(STORE_KEY)) return;
    const { value } = await Preferences.get({ key: STORE_KEY });
    if (value) localStorage.setItem(STORE_KEY, value);
  } catch { /* nothing to restore */ }
}

/** After the first draw. */
export function appReady(): void {
  StatusBar.setStyle({ style: Style.Default }).catch(() => {});
  SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
}

export function nativeHaptic(): void {
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** Saves a file to the app's cache, then opens the iOS share sheet (Save to Files, AirDrop, Mail...). */
export async function shareFile(name: string, text: string): Promise<"shared" | "cancelled"> {
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title: name, files: [uri] });
    return "shared";
  } catch (err: any) {
    if (/cancel/i.test(String(err?.message ?? err))) return "cancelled";
    throw err;
  }
}

/** Opens the iOS print sheet for the printable cards. Falls back to the share sheet. */
export async function printHtml(html: string): Promise<string> {
  try {
    const { printed } = await Print.printHtml({ html, name: "Pantry Prep cards" });
    return printed ? "Sent to the printer." : "Printing cancelled.";
  } catch {
    const r = await shareFile("pantry-prep-cards.html", html);
    return r === "shared" ? "Ready to print or save." : "Cancelled.";
  }
}

let lastSaved = "";
let lastPlan = "";

/** Called after every change to the store. */
export async function syncStore(state: AppState): Promise<void> {
  const json = JSON.stringify(state);
  if (json !== lastSaved) {
    lastSaved = json;
    Preferences.set({ key: STORE_KEY, value: json }).catch(() => {});
  }
  const plan = reminderPlan(state, todayIso());
  const key = JSON.stringify(plan);
  if (key === lastPlan) return;
  lastPlan = key;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!plan.length) return;
    // Ask only once there is something worth a reminder, never on first launch.
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === "prompt" || perm.display === "prompt-with-rationale") perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return;
    await LocalNotifications.schedule({
      notifications: plan.map((r) => {
        const [y, m, d] = r.day.split("-").map(Number);
        return { id: r.id, title: r.title, body: r.body, schedule: { at: new Date(y, m - 1, d, 10, 0), allowWhileIdle: true } };
      }),
    });
  } catch { lastPlan = ""; }
}
