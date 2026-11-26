// Photo scanning with Claude, called straight from the browser with the person's own
// Anthropic API key. The key and the photos never touch a Pantry Prep server: the key is
// kept in this browser's storage, and photos go only to Anthropic for the scan.
import { CATALOGUE, GROUPS, KINDS, KIT } from "./data";

const KEY_STORE = "pantry-prep-anthropic-key";
export const SCAN_MODEL = "claude-opus-5-5";
const MAX_SIDE = 1568; // longest edge sent; larger photos are shrunk on the phone first
export const MAX_PHOTOS = 4;

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
async function toJpegBase64(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read photo"))), "image/jpeg", 0.85),
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function scanPrompt(): string {
  const cat = CATALOGUE.map((c) => `${c.id}: ${c.name} (${c.pack})`).join("\n");
  const kit = KIT.filter((k) => k.look).map((k) => `${k.id}: ${k.look}`).join("\n");
  return [
    "These photos show part of a UK household's emergency store. Do two things.",
    "",
    "1. List every food or drink product you can see, one entry per distinct product.",
    'If it is the same kind of product as a catalogue item below, set "id" to that catalogue id. Otherwise set "id" to "" and estimate nutrition for one pack from typical UK labels.',
    "Count every visible pack. If packs are stacked or partly hidden, give your best count and set confidence to \"low\".",
    "",
    "Catalogue:",
    cat,
    "",
    `"kind" is one of: ${Object.keys(KINDS).join(", ")}, or "" if none fits.`,
    `"group" is one of: ${Object.keys(GROUPS).join(", ")}.`,
    "",
    "2. List which of these emergency kit items are clearly visible. Only include an id if you can actually see that item:",
    kit,
  ].join("\n");
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["food", "kit"],
  properties: {
    food: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "pack", "count", "kind", "group", "kcal", "protein", "fibre", "litres", "portions", "confidence"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          pack: { type: "string" },
          count: { type: "integer" },
          kind: { type: "string" },
          group: { type: "string", enum: Object.keys(GROUPS) },
          kcal: { type: "number" },
          protein: { type: "number" },
          fibre: { type: "number" },
          litres: { type: "number" },
          portions: { type: "number" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    kit: { type: "array", items: { type: "string" } },
  },
};

export type ScanErrorCode = "no_key" | "bad_key" | "rate_limited" | "refused" | "network" | "failed";

export class ScanError extends Error {
  constructor(public code: ScanErrorCode, message: string) {
    super(message);
  }
}

/** Sends the photos to Claude and returns the raw result: { food: [...], kit: [...] }. */
export async function scanWithApiKey(files: Blob[], signal?: AbortSignal): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) throw new ScanError("no_key", "No API key saved");
  const images = await Promise.all(files.slice(0, MAX_PHOTOS).map(toJpegBase64));
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
        output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
        messages: [
          {
            role: "user",
            content: [
              ...images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
              { type: "text" as const, text: scanPrompt() },
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
