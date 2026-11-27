// Pure checks for the scan worker: request validation, origins and daily limits.
// No Cloudflare APIs here, so the app's test runner covers it (rules.test.ts).

export const MAX_IMAGE_CHARS = 4_000_000; // about 3 MB of JPEG once decoded; the app sends ~300 KB

export interface ScanRequest {
  device: string;
  code: string;
  images: string[];
}

export type Invalid = { error: string; message: string; status: number };

export function parseScanRequest(body: unknown, maxPhotos: number): ScanRequest | Invalid {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const device = typeof b.device === "string" ? b.device : "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(device)) return { error: "bad_request", message: "Missing device id", status: 400 };
  const images = Array.isArray(b.images) ? b.images : [];
  if (!images.length) return { error: "bad_request", message: "No photos", status: 400 };
  if (images.length > maxPhotos) return { error: "too_big", message: `Up to ${maxPhotos} photos per scan`, status: 413 };
  for (const img of images) {
    if (typeof img !== "string" || !img.startsWith("/9j/")) return { error: "bad_request", message: "Photos must be JPEG", status: 400 };
    if (img.length > MAX_IMAGE_CHARS) return { error: "too_big", message: "Photo too large", status: 413 };
  }
  return { device, code: typeof b.code === "string" ? b.code.trim().slice(0, 64) : "", images: images as string[] };
}

export function allowedOrigin(origin: string | null, list: string): string | null {
  if (!origin) return null;
  const allowed = list.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  return allowed.includes(origin.replace(/\/+$/, "")) ? origin : null;
}

/** Constant-time-ish comparison for the invite code. */
export function codeMatches(given: string, expected: string): boolean {
  const a = given.trim().toLowerCase();
  const b = expected.trim().toLowerCase();
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const dayKey = (now: Date) => now.toISOString().slice(0, 10);

export interface Limit {
  key: string; // e.g. "device:abc", "ip:1.2.3.4", "total"
  max: number;
  /** Which error to give when this limit is reached. */
  error: "daily_limit" | "busy";
}

export type TakeResult = { ok: true; remaining: number } | { ok: false; error: Limit["error"]; remaining: number };

/**
 * Decides whether `n` more photos fit under every limit, given today's counts.
 * `remaining` is what is left on the first limit (the device's own allowance).
 */
export function decideTake(counts: Record<string, number>, limits: Limit[], n: number): TakeResult {
  const left = (l: Limit) => Math.max(0, l.max - (counts[l.key] || 0));
  const own = limits.length ? left(limits[0]) : 0;
  for (const l of limits) if (left(l) < n) return { ok: false, error: l.error, remaining: own };
  return { ok: true, remaining: own - n };
}
