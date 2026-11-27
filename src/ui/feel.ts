// Small touches of feedback shared by the whole app.
export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A short buzz to confirm an action, on phones that allow it (Android). iPhones ignore it. */
export function haptic(ms = 12) {
  try { if (!reducedMotion() && "vibrate" in navigator) navigator.vibrate(ms); } catch { /* not supported */ }
}
