// Pantry Prep scan worker (Cloudflare Workers, free plan).
// The app posts shrunk JPEG photos here. The worker checks the site, the optional invite
// code and the daily limits, then asks Claude what food is in the photos and returns the list.
// It holds the only copy of the Anthropic key, and it does not store the photos.
import Anthropic from "@anthropic-ai/sdk";
import { SCAN_SCHEMA, scanPrompt } from "../../src/scanPrompt";
import { allowedOrigin, codeMatches, dayKey, decideTake, parseScanRequest, type Limit } from "./rules";

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** Only for local testing against a mock. */
  ANTHROPIC_BASE_URL?: string;
  ACCESS_CODE?: string;
  ALLOWED_ORIGINS: string;
  SCAN_MODEL: string;
  SCAN_EFFORT: string;
  PHOTOS_PER_SCAN: string;
  DEVICE_DAILY_PHOTOS: string;
  IP_DAILY_PHOTOS: string;
  TOTAL_DAILY_PHOTOS: string;
  QUOTA: DurableObjectNamespace;
}

const PROMPT = scanPrompt();
const int = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : d);

function json(body: unknown, status: number, origin: string | null): Response {
  const headers: Record<string, string> = { "content-type": "application/json", "cache-control": "no-store" };
  if (origin) Object.assign(headers, { "access-control-allow-origin": origin, vary: "Origin" });
  return new Response(JSON.stringify(body), { status, headers });
}

/** Asks the single Quota object to take (or give back) photos from today's allowances. */
async function quota(env: Env, op: "take" | "give", limits: Limit[], n: number): Promise<{ ok: boolean; error?: string; remaining: number }> {
  const stub = env.QUOTA.get(env.QUOTA.idFromName("daily"));
  const res = await stub.fetch("https://quota/" + op, { method: "POST", body: JSON.stringify({ day: dayKey(new Date()), limits, n }) });
  return res.json();
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = allowedOrigin(req.headers.get("origin"), env.ALLOWED_ORIGINS);

    if (req.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
          vary: "Origin",
        },
      });
    }
    if (url.pathname === "/" && req.method === "GET") return json({ ok: true, service: "pantry-prep-scan" }, 200, origin);
    if (url.pathname !== "/scan" || req.method !== "POST") return json({ error: "not_found" }, 404, origin);
    if (!origin) return json({ error: "forbidden", message: "This site may not use the scanner" }, 403, null);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "failed", message: "Scanner not set up yet" }, 503, origin);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad_request", message: "Expected JSON" }, 400, origin);
    }
    const parsed = parseScanRequest(body, int(env.PHOTOS_PER_SCAN, 3));
    if ("error" in parsed) return json({ error: parsed.error, message: parsed.message }, parsed.status, origin);

    if (env.ACCESS_CODE) {
      if (!parsed.code) return json({ error: "code_needed", message: "Enter your invite code" }, 401, origin);
      if (!codeMatches(parsed.code, env.ACCESS_CODE)) return json({ error: "bad_code", message: "That invite code is not right" }, 401, origin);
    }

    const ip = req.headers.get("cf-connecting-ip") || "unknown";
    const limits: Limit[] = [
      { key: `device:${parsed.device}`, max: int(env.DEVICE_DAILY_PHOTOS, 12), error: "daily_limit" },
      { key: `ip:${ip}`, max: int(env.IP_DAILY_PHOTOS, 36), error: "daily_limit" },
      { key: "total", max: int(env.TOTAL_DAILY_PHOTOS, 300), error: "busy" },
    ];
    const n = parsed.images.length;
    const taken = await quota(env, "take", limits, n);
    if (!taken.ok) {
      const message = taken.error === "busy" ? "Photo scanning is full for today" : "No photo scans left today on this phone";
      return json({ error: taken.error, message, remaining: taken.remaining }, 429, origin);
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 1 });
    try {
      const response = await client.messages.create({
        model: env.SCAN_MODEL || "claude-haiku-5-5",
        max_tokens: 12000,
        output_config: {
          effort: (["low", "medium", "high"].includes(env.SCAN_EFFORT) ? env.SCAN_EFFORT : "medium") as "low" | "medium" | "high",
          format: { type: "json_schema", schema: SCAN_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: [
              ...parsed.images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
              { type: "text" as const, text: PROMPT },
            ],
          },
        ],
      });
      // One log line per scan, visible in the Cloudflare dashboard, for the real cost per scan.
      console.log(JSON.stringify({ scan: { photos: n, model: response.model, stop: response.stop_reason, input: response.usage.input_tokens, output: response.usage.output_tokens } }));
      if (response.stop_reason === "refusal") {
        await quota(env, "give", limits, n);
        return json({ error: "refused", message: "Claude could not scan these photos", remaining: taken.remaining + n }, 422, origin);
      }
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      const data = JSON.parse(text) as { food: unknown[]; kit: unknown[] };
      return json({ food: data.food, kit: data.kit, remaining: taken.remaining }, 200, origin);
    } catch (err) {
      await quota(env, "give", limits, n);
      if (err instanceof Anthropic.RateLimitError) return json({ error: "rate_limited", message: "Too many scans just now", remaining: taken.remaining + n }, 429, origin);
      if (err instanceof Anthropic.APIError) console.log(JSON.stringify({ scanError: { status: err.status, message: err.message } }));
      else console.log(JSON.stringify({ scanError: { message: err instanceof Error ? err.message : String(err) } }));
      return json({ error: "failed", message: "The scan did not finish", remaining: taken.remaining + n }, 502, origin);
    }
  },
};

/**
 * Today's photo counts for every device, IP and the whole service. One instance ("daily")
 * handles every request, which is plenty for a beta. Yesterday's counts are wiped at the
 * first request of a new day (UTC).
 */
export class Quota {
  constructor(private state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const { day, limits, n } = (await req.json()) as { day: string; limits: Limit[]; n: number };
    const op = new URL(req.url).pathname.slice(1);
    const storage = this.state.storage;
    if ((await storage.get<string>("day")) !== day) {
      await storage.deleteAll();
      await storage.put("day", day);
    }
    const keys = limits.map((l) => l.key);
    const stored = await storage.get<number>(keys);
    const counts: Record<string, number> = {};
    for (const k of keys) counts[k] = stored.get(k) || 0;

    if (op === "give") {
      const next: Record<string, number> = {};
      for (const k of keys) next[k] = Math.max(0, counts[k] - n);
      await storage.put(next);
      return Response.json({ ok: true, remaining: 0 });
    }
    const result = decideTake(counts, limits, n);
    if (result.ok) {
      const next: Record<string, number> = {};
      for (const k of keys) next[k] = counts[k] + n;
      await storage.put(next);
    }
    return Response.json(result);
  }
}
