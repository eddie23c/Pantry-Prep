// Pure checks for the scan worker: request validation, origins and daily limits.
// No Cloudflare APIs here, so the app's test runner covers it (rules.test.ts).

export const MAX_IMAGE_CHARS = 4_000_000; // about 3 MB of JPEG once decoded; the app sends ~300 KB

export interface ScanRequest {
  device: string;
  code: string;
  images: string[];
  /** The images are frames from one short video of a single pile. */
  video: boolean;
}

export type Invalid = { error: string; message: string; status: number };

/**
 * `maxFrames`: how many frames a video scan may send. Frames are smaller than photos
 * (1280 px, not 1400) and overlap, so a video scan is charged by photoCost, not per frame.
 */
export function parseScanRequest(body: unknown, maxPhotos: number, maxFrames = 6): ScanRequest | Invalid {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const device = typeof b.device === "string" ? b.device : "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(device)) return { error: "bad_request", message: "Missing device id", status: 400 };
  const images = Array.isArray(b.images) ? b.images : [];
  const video = b.video === true;
  if (!images.length) return { error: "bad_request", message: "No photos", status: 400 };
  if (video && images.length > maxFrames) return { error: "too_big", message: `Up to ${maxFrames} video frames per scan`, status: 413 };
  if (!video && images.length > maxPhotos) return { error: "too_big", message: `Up to ${maxPhotos} photos per scan`, status: 413 };
  for (const img of images) {
    if (typeof img !== "string" || !img.startsWith("/9j/")) return { error: "bad_request", message: "Photos must be JPEG", status: 400 };
    if (img.length > MAX_IMAGE_CHARS) return { error: "too_big", message: "Photo too large", status: 413 };
  }
  return { device, code: typeof b.code === "string" ? b.code.trim().slice(0, 64) : "", images: images as string[], video };
}

/** How many photos of today's allowance a scan uses: one per photo, or one per two video frames. */
export function photoCost(r: Pick<ScanRequest, "images" | "video">): number {
  return r.video ? Math.ceil(r.images.length / 2) : r.images.length;
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

/** Standard API prices in US dollars per million tokens (input, output), for cost reporting. */
export const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
  "claude-fable-5-2": [8, 40],
};

export function costUsd(model: string, input: number, output: number): number | null {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  if (!key) return null;
  const [i, o] = PRICES[key];
  return (input * i + output * o) / 1e6;
}

/** The models a compare scan runs, from a comma-separated var. At most 4, known ids only. */
export function compareModels(list: string | undefined): string[] {
  const all = (list || "claude-haiku-5-5,claude-sonnet-5-5,claude-opus-5-5").split(",").map((s) => s.trim()).filter((m) => /^claude-[a-z0-9-]+$/.test(m));
  return [...new Set(all)].slice(0, 4);
}
