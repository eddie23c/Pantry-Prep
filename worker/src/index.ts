// Pantry Prep scan worker (Cloudflare Workers, free plan).
// The app posts shrunk JPEG photos here. The worker checks the site, the optional invite
// code and the daily limits, then asks Claude what food is in the photos and returns the list.
// It holds the only copy of the Anthropic key, and it does not store the photos.
//
// Testers (anyone with TESTER_CODE) can also run a compare scan: one photo through several
// models side by side (COMPARE_MODELS), pick the most accurate list, and see a running tally.
import Anthropic from "@anthropic-ai/sdk";
import { SCAN_SCHEMA, scanPrompt } from "../../src/scanPrompt";
import { allowedOrigin, codeMatches, compareModels, costUsd, dayKey, decideTake, parseScanRequest, photoCost, type Limit } from "./rules";

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** Only for local testing against a mock. */
  ANTHROPIC_BASE_URL?: string;
  ACCESS_CODE?: string;
  ALLOWED_ORIGINS: string;
  SCAN_MODEL: string;
  SCAN_EFFORT: string;
  PHOTOS_PER_SCAN: string;
  /** Frames a video scan may send. */
  VIDEO_FRAMES?: string;
  DEVICE_DAILY_PHOTOS: string;
  IP_DAILY_PHOTOS: string;
  TOTAL_DAILY_PHOTOS: string;
  /** Turns on compare scans for people who know it. Unset = compare scans off. */
  TESTER_CODE?: string;
  COMPARE_MODELS?: string;
  TESTER_DAILY_COMPARES?: string;
  TOTAL_DAILY_COMPARES?: string;
  QUOTA: DurableObjectNamespace;
}

const PROMPT = scanPrompt();
const VIDEO_PROMPT = scanPrompt({ video: true });
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

async function votes(env: Env, op: "record" | "vote" | "tally", body: unknown): Promise<any> {
  const stub = env.QUOTA.get(env.QUOTA.idFromName("votes"));
  const res = await stub.fetch("https://quota/" + op, { method: "POST", body: JSON.stringify(body) });
  return res.json();
}

const effortOf = (env: Env) => (["low", "medium", "high"].includes(env.SCAN_EFFORT) ? env.SCAN_EFFORT : "medium") as "low" | "medium" | "high";

/** One Claude call. `fallback` lets a declined request run on another model (not used when comparing). */
async function scanOnce(client: Anthropic, model: string, effort: "low" | "medium" | "high", images: string[], fallback: boolean, video = false) {
  const started = Date.now();
  const response = await client.beta.messages.create({
    model,
    max_tokens: 12000,
    ...(fallback && !model.startsWith("claude-haiku") ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    output_config: { effort, format: { type: "json_schema", schema: SCAN_SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
          { type: "text" as const, text: video ? VIDEO_PROMPT : PROMPT },
        ],
      },
    ],
  });
  const seconds = (Date.now() - started) / 1000;
  const { input_tokens: input, output_tokens: output } = response.usage;
  // One log line per call, visible in the Cloudflare dashboard, for the real cost per scan.
  console.log(JSON.stringify({ scan: { photos: images.length, video, model: response.model, stop: response.stop_reason, input, output, seconds } }));
  if (response.stop_reason === "refusal") return { refused: true as const, model: response.model, seconds, input, output };
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const data = JSON.parse(text) as { food: unknown[]; kit: unknown[] };
  return { refused: false as const, model: response.model, seconds, input, output, food: data.food, kit: data.kit };
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
    const routes = ["/scan", "/compare", "/vote", "/tally"];
    if (!routes.includes(url.pathname) || req.method !== "POST") return json({ error: "not_found" }, 404, origin);
    if (!origin) return json({ error: "forbidden", message: "This site may not use the scanner" }, 403, null);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "failed", message: "Scanner not set up yet" }, 503, origin);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad_request", message: "Expected JSON" }, 400, origin);
    }
    if (url.pathname !== "/scan") return tester(url.pathname, body as Record<string, unknown>, env, origin);
    const parsed = parseScanRequest(body, int(env.PHOTOS_PER_SCAN, 3), int(env.VIDEO_FRAMES, 6));
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
    const n = photoCost(parsed);
    const taken = await quota(env, "take", limits, n);
    if (!taken.ok) {
      const message = taken.error === "busy" ? "Photo scanning is full for today" : "No photo scans left today on this phone";
      return json({ error: taken.error, message, remaining: taken.remaining }, 429, origin);
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 1 });
    try {
      const r = await scanOnce(client, env.SCAN_MODEL || "claude-haiku-5-5", effortOf(env), parsed.images, true, parsed.video);
      if (r.refused) {
        await quota(env, "give", limits, n);
        return json({ error: "refused", message: "Claude could not scan these photos", remaining: taken.remaining + n }, 422, origin);
      }
      return json({ food: r.food, kit: r.kit, remaining: taken.remaining }, 200, origin);
    } catch (err) {
      await quota(env, "give", limits, n);
      if (err instanceof Anthropic.RateLimitError) return json({ error: "rate_limited", message: "Too many scans just now", remaining: taken.remaining + n }, 429, origin);
      logError(err);
      return json({ error: "failed", message: "The scan did not finish", remaining: taken.remaining + n }, 502, origin);
    }
  },
};

function logError(err: unknown) {
  if (err instanceof Anthropic.APIError) console.log(JSON.stringify({ scanError: { status: err.status, message: err.message } }));
  else console.log(JSON.stringify({ scanError: { message: err instanceof Error ? err.message : String(err) } }));
}

/** Compare scans, votes and the tally. Only for people with the tester code. */
async function tester(path: string, b: Record<string, unknown>, env: Env, origin: string): Promise<Response> {
  if (!env.TESTER_CODE) return json({ error: "compare_off", message: "Model comparison is not turned on" }, 403, origin);
  if (typeof b.tester !== "string" || !codeMatches(b.tester, env.TESTER_CODE)) return json({ error: "bad_tester", message: "That tester code is not right" }, 401, origin);
  const models = compareModels(env.COMPARE_MODELS);

  if (path === "/tally") return json(await votes(env, "tally", { models }), 200, origin);
  if (path === "/vote") {
    const pick = typeof b.model === "string" ? b.model : "";
    if (pick !== "none" && !models.includes(pick)) return json({ error: "bad_request", message: "Unknown model" }, 400, origin);
    return json(await votes(env, "vote", { model: pick, models }), 200, origin);
  }

  // /compare: one photo through every model at once.
  const parsed = parseScanRequest(b, 1);
  if ("error" in parsed) return json({ error: parsed.error, message: parsed.error === "too_big" ? "Compare one photo at a time" : parsed.message }, parsed.status, origin);
  const limits: Limit[] = [
    { key: `compare:${parsed.device}`, max: int(env.TESTER_DAILY_COMPARES, 20), error: "daily_limit" },
    { key: "compare-total", max: int(env.TOTAL_DAILY_COMPARES, 40), error: "busy" },
  ];
  const taken = await quota(env, "take", limits, 1);
  if (!taken.ok) return json({ error: taken.error, message: "No compare scans left today", remaining: taken.remaining }, 429, origin);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 1 });
  const settled = await Promise.allSettled(models.map((m) => scanOnce(client, m, effortOf(env), parsed.images, false)));
  const results = settled.map((s, i) => {
    const model = models[i];
    if (s.status === "rejected") { logError(s.reason); return { model, ok: false, error: "failed" }; }
    const r = s.value;
    const usd = costUsd(model, r.input, r.output);
    if (r.refused) return { model, ok: false, error: "refused", seconds: r.seconds, usd };
    return { model, ok: true, food: r.food, kit: r.kit, seconds: r.seconds, input: r.input, output: r.output, usd };
  });
  if (!results.some((r) => r.ok)) await quota(env, "give", limits, 1);
  await votes(env, "record", {
    runs: results.filter((r) => r.ok).map((r) => ({
      model: r.model,
      items: ((r.food as { count?: number }[]) || []).reduce((t, f) => t + (Number(f.count) || 0), 0),
      seconds: r.seconds || 0,
      usd: r.usd || 0,
    })),
  });
  return json({ results, remaining: taken.remaining }, 200, origin);
}

/**
 * Today's photo counts for every device, IP and the whole service. One instance ("daily")
 * handles every request, which is plenty for a beta. Yesterday's counts are wiped at the
 * first request of a new day (UTC).
 */
export class Quota {
  constructor(private state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const op = new URL(req.url).pathname.slice(1);
    const storage = this.state.storage;
    if (op === "record" || op === "vote" || op === "tally") return this.votes(op, await req.json());
    const { day, limits, n } = (await req.json()) as { day: string; limits: Limit[]; n: number };
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

  /**
   * The "votes" instance: running totals per model across every compare scan, kept until
   * Eddie wipes them (delete and redeploy the worker, or rename the instance).
   */
  private async votes(op: string, body: any): Promise<Response> {
    const storage = this.state.storage;
    const bump = async (key: string, by: number) => storage.put(key, ((await storage.get<number>(key)) || 0) + by);
    if (op === "record") {
      for (const r of body.runs as { model: string; items: number; seconds: number; usd: number }[]) {
        await bump(`runs:${r.model}`, 1);
        await bump(`items:${r.model}`, r.items);
        await bump(`seconds:${r.model}`, r.seconds);
        await bump(`usd:${r.model}`, r.usd);
      }
      await bump("compares", 1);
      return Response.json({ ok: true });
    }
    if (op === "vote") {
      await bump(`wins:${body.model}`, 1);
      await bump("votes", 1);
    }
    const models = body.models as string[];
    const get = async (k: string) => (await storage.get<number>(k)) || 0;
    const rows = [];
    for (const m of models) {
      const runs = await get(`runs:${m}`);
      rows.push({
        model: m, runs, wins: await get(`wins:${m}`),
        avgItems: runs ? (await get(`items:${m}`)) / runs : 0,
        avgSeconds: runs ? (await get(`seconds:${m}`)) / runs : 0,
        avgUsd: runs ? (await get(`usd:${m}`)) / runs : 0,
      });
    }
    return Response.json({ compares: await get("compares"), votes: await get("votes"), none: await get("wins:none"), models: rows });
  }
}
