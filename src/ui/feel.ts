// Small touches of feedback shared by the whole app.
import { isNativeApp } from "../native/platform";

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A short buzz to confirm an action: the Taptic Engine in the iPhone app, vibrate on Android browsers. */
export function haptic(ms = 12) {
  if (isNativeApp()) { if (!reducedMotion()) import("../native/bridge").then((b) => b.nativeHaptic()); return; }
  try { if (!reducedMotion() && "vibrate" in navigator) navigator.vibrate(ms); } catch { /* not supported */ }
}
