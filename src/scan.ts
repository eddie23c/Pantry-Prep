// Photo scanning with Claude. Two routes:
// 1. Hosted (the default when the app is built with VITE_SCAN_URL): photos go to the Pantry
//    Prep scan worker (worker/), which holds the key, applies daily limits and calls Claude.
//    Nobody needs their own key. The worker does not keep the photos.
// 2. Own key (advanced): the browser calls Anthropic directly with the person's own key,
//    kept only in this browser's storage.
import { SCAN_SCHEMA, scanPrompt, VIDEO_FRAMES } from "./scanPrompt";
import { FRAME_SIDE } from "./frames";

export { VIDEO_FRAMES };

/** The scan worker's address, set at build time. Empty means hosted scanning is off. */
export const SCAN_URL: string = ((import.meta.env.VITE_SCAN_URL as string | undefined) || "").replace(/\/+$/, "");
const DEVICE_STORE = "pantry-prep-device";
const INVITE_STORE = "pantry-prep-invite";
const TESTER_STORE = "pantry-prep-tester";

const KEY_STORE = "pantry-prep-anthropic-key";
export const SCAN_MODEL = "claude-opus-5-5";
// Longest edge sent. Big enough to read most labels on a shelf photo, small enough to keep
// uploads around 300 KB and each photo near 1,600 image tokens.
const MAX_SIDE = 1400;
export const MAX_PHOTOS = 3;

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) || "";
  } catch {
    return "";
  }
}

export function setApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORE, key);
    else localStorage.removeItem(KEY_STORE);
  } catch {
    /* storage blocked */
  }
}

export function looksLikeKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim());
}

/** Shrinks a photo to at most MAX_SIDE pixels on its longest edge and returns base64 JPEG. */
export async function toJpegBase64(file: Blob, maxSide = MAX_SIDE): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read photo"))), "image/jpeg", 0.8),
  );
  return blobBase64(blob);
}

async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export type ScanErrorCode =
  | "no_key" | "bad_key" | "rate_limited" | "refused" | "network" | "failed"
  | "code_needed" | "bad_code" | "daily_limit" | "busy" | "too_big" | "bad_tester" | "compare_off";

export class ScanError extends Error {
  constructor(public code: ScanErrorCode, message: string, public remaining: number | null = null) {
    super(message);
  }
}

function store(key: string, value?: string): string {
  try {
    if (value === undefined) return localStorage.getItem(key) || "";
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
  return value || "";
}

/** A random id for this browser, so the worker can give each phone its own daily allowance. */
export function deviceId(): string {
  let id = store(DEVICE_STORE);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    store(DEVICE_STORE, id);
  }
  return id;
}

export const getInviteCode = () => store(INVITE_STORE);
export const setInviteCode = (code: string) => store(INVITE_STORE, code.trim());

export interface HostedResult {
  data: unknown;
  /** Photo scans left today on this phone, if the worker said. */
  remaining: number | null;
}

export const getTesterCode = () => store(TESTER_STORE);
export const setTesterCode = (code: string) => store(TESTER_STORE, code.trim());

const KNOWN: ScanErrorCode[] = ["code_needed", "bad_code", "daily_limit", "busy", "too_big", "refused", "rate_limited", "bad_tester", "compare_off"];

/** Posts JSON to the scan worker and returns the reply, or throws a ScanError. */
async function post(path: string, payload: unknown, signal?: AbortSignal): Promise<any> {
  if (!SCAN_URL) throw new ScanError("failed", "Hosted scanning is not set up");
  let res: Response;
  try {
    res = await fetch(`${SCAN_URL}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ScanError("network", "No connection");
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  const remaining = body && typeof body.remaining === "number" ? body.remaining : null;
  if (!res.ok) {
    const code = body && typeof body.error === "string" ? body.error : "";
    throw new ScanError(KNOWN.includes(code as ScanErrorCode) ? (code as ScanErrorCode) : "failed", (body && body.message) || `Scan failed (${res.status})`, remaining);
  }
  return body;
}

/** Photos, or (video) frames from one video, shrunk and encoded for sending. */
const encode = (files: Blob[], video: boolean) =>
  Promise.all(files.slice(0, video ? VIDEO_FRAMES : MAX_PHOTOS).map((f) =>
    // Video frames are already small JPEGs (frames.ts); encoding them again would blur small print.
    video && f.type === "image/jpeg" ? blobBase64(f) : toJpegBase64(f, video ? FRAME_SIDE : MAX_SIDE)));

/** Sends the photos (or video frames) to the Pantry Prep scan worker. */
export async function scanHosted(files: Blob[], signal?: AbortSignal, video = false): Promise<HostedResult> {
  const images = await encode(files, video);
  const body = await post("/scan", { device: deviceId(), code: getInviteCode(), images, ...(video ? { video: true } : {}) }, signal);
  return { data: body, remaining: typeof body.remaining === "number" ? body.remaining : null };
}

export interface CompareRun {
  model: string;
  ok: boolean;
  error?: string;
  food?: unknown[];
  kit?: unknown[];
  seconds?: number;
  usd?: number | null;
}

export interface Tally {
  compares: number;
  votes: number;
  none: number;
  models: { model: string; runs: number; wins: number; avgItems: number; avgSeconds: number; avgUsd: number }[];
}

/** Testers only: one photo through every compare model at once. */
export async function scanCompare(file: Blob, signal?: AbortSignal): Promise<{ results: CompareRun[]; remaining: number | null }> {
  const images = [await toJpegBase64(file)];
  const body = await post("/compare", { device: deviceId(), code: getInviteCode(), tester: getTesterCode(), images }, signal);
  return { results: Array.isArray(body.results) ? body.results : [], remaining: typeof body.remaining === "number" ? body.remaining : null };
}

/** Records which model's list was most accurate ("none" if none were). Returns the new tally. */
export const sendVote = (model: string): Promise<Tally> => post("/vote", { tester: getTesterCode(), model });
export const getTally = (): Promise<Tally> => post("/tally", { tester: getTesterCode() });

/** Short names for the models a compare scan can show. */
export function modelLabel(id: string): string {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id);
  if (!m) return id;
  return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? "." + m[3] : ""}`;
}

/** US dollars to pence, roughly, for showing costs. */
export const pence = (usd: number) => `${(usd * 79).toFixed(usd * 79 < 1 ? 2 : 1)}p`;

/** Sends the photos to Claude and returns the raw result: { food: [...], kit: [...] }. */
export async function scanWithApiKey(files: Blob[], signal?: AbortSignal, video = false): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) throw new ScanError("no_key", "No API key saved");
  const images = await encode(files, video);
  // Loaded only when a scan runs, so the SDK does not slow the first page load.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  // The key belongs to the person using the app and is only sent to Anthropic.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const response = await client.beta.messages.create(
      {
        model: SCAN_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema: SCAN_SCHEMA } },
        messages: [
          {
            role: "user",
            content: [
              ...images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
              { type: "text" as const, text: scanPrompt({ video }) },
            ],
          },
        ],
      },
      { signal },
    );
    if (response.stop_reason === "refusal") throw new ScanError("refused", "Claude declined to scan these photos");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof ScanError) throw err;
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new ScanError("bad_key", "API key was not accepted");
    if (err instanceof Anthropic.RateLimitError) throw new ScanError("rate_limited", "Rate limited");
    if (err instanceof Anthropic.APIUserAbortError) throw err;
    if (err instanceof Anthropic.APIConnectionError) throw new ScanError("network", "No connection");
    if (err instanceof SyntaxError) throw new ScanError("failed", "Unexpected reply");
    throw new ScanError("failed", err instanceof Error ? err.message : "Scan failed");
  }
}
