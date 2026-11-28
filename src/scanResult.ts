// Turning a photo-scan reply into store items and kit ticks. Pure, tested in scanResult.test.ts.
import { addMonths, isIsoDate, shelfMonths } from "./dates";
import { CAT, CATALOGUE, GROUPS, KINDS, KIT, type GroupId, type KitItem } from "./data";

export interface ScannedItem {
  keep: boolean;
  cat: string | null;
  conf: "high" | "medium" | "low";
  name: string;
  pack: string;
  count: number;
  group: GroupId;
  kind: string | null;
  kcal: number;
  protein: number;
  fibre: number;
  portions: number;
  litres: number;
  /** Best-before date, "YYYY-MM-DD": read off the pack, or taken from a matching pack (see `from`). */
  bb?: string;
  /** How many of the packs Claude read the date on. */
  seen: number;
  /** Where the date came from, set by fillDates. */
  from?: DateSource;
  /** With from "estimate": the shelf-life guess shown for review. Not saved as a date. */
  guess?: string;
}

/**
 * read: on every pack. some: on some packs, the rest assumed the same. match: on an identical
 * product elsewhere in the scan. estimate: none seen, so a typical shelf life. you: typed in.
 */
export type DateSource = "read" | "some" | "match" | "estimate" | "you";

/** Prompt for scans that run inside Claude (no API key), which reply with free-form JSON. */
export function samplePrompt(video = false): string {
  const cat = CATALOGUE.map((c) => `${c.id}: ${c.name} (${c.pack})`).join("\n");
  const intro = video
    ? "These images are frames, in order, from one short video panning across a single pile of a UK household's emergency store. The same pack appears in several frames: count each physical pack once across all frames. Do two things.\n\n"
    : "These photos show part of a UK household's emergency store. Do two things.\n\n";
  return intro + "1. List every food or drink product you can see.\n" +
    'For each distinct product give one entry. If it is the same kind of product as one of these catalogue items, set "id" to that catalogue id; otherwise set "id" to null and estimate nutrition for one pack from typical UK labels.\n\nCatalogue:\n' + cat + "\n\n" +
    `"kind" must be one of: ${Object.keys(KINDS).join(", ")}, or null.\n"group" must be one of: water, fruitveg, starchy, protein, dairy, oils, other.\n` +
    'Count every visible pack. If packs are stacked or partly hidden, give your best count and set confidence to "low".\n' +
    'If a best-before or use-by date is clearly legible, set "bb" to it as YYYY-MM-DD (month and year only: use the last day of that month). If packs of one product show different dates, give one entry per date. Otherwise leave "bb" out. Never guess a date. Set "seen" to how many packs in the entry you read the date on (0 if none).\n\n' +
    "2. Say which of these emergency kit items are clearly visible (only include an id if you can actually see that item):\n" +
    KIT.filter((k) => k.look).map((k) => `${k.id}: ${k.look}`).join("\n") + "\n\n" +
    'Reply with only a JSON object like:\n{"food":[{"id":"tuna","name":"Tuna chunks in spring water","pack":"145 g tin","count":3,"kind":"fish","group":"protein","kcal":110,"protein":25,"fibre":0,"litres":0,"portions":1,"bb":"2028-03-31","seen":1,"confidence":"high"}],"kit":["torch","batteries"]}';
}

export function kitFrom(data: unknown): KitItem[] {
  const ids = data && typeof data === "object" && Array.isArray((data as any).kit) ? ((data as any).kit as unknown[]) : [];
  return KIT.filter((k) => k.look && ids.includes(k.id));
}

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : d));
};

/** A real date, not absurdly far past or ahead (a misread label is more likely than a 2041 tin). */
export function plausibleBb(v: unknown, now: Date = new Date()): v is string {
  if (!isIsoDate(v)) return false;
  const y = Number(v.slice(0, 4)), thisYear = now.getFullYear();
  return y >= thisYear - 3 && y <= thisYear + 10;
}

export function normalise(data: unknown): ScannedItem[] {
  let list: unknown = data;
  if (list && !Array.isArray(list) && typeof list === "object") list = (list as any).food;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 60).map((raw): ScannedItem => {
    const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
    const id = typeof d.id === "string" && CAT[d.id] ? d.id : null;
    const base = id ? CAT[id] : null;
    return {
      keep: true, cat: id,
      conf: ["high", "medium", "low"].includes(d.confidence) ? d.confidence : "medium",
      name: String(d.name || base?.name || "Unknown item").slice(0, 80),
      pack: String(d.pack || base?.pack || "").slice(0, 30),
      count: Math.round(num(d.count, 1, 99, 1)),
      group: base ? base.group : d.group in GROUPS ? d.group : "other",
      kind: base ? base.kind : typeof d.kind === "string" && KINDS[d.kind] ? d.kind : null,
      kcal: base ? base.kcal : num(d.kcal, 0, 5000, 0),
      protein: base ? base.protein : num(d.protein, 0, 300, 0),
      fibre: base ? base.fibre : num(d.fibre, 0, 200, 0),
      portions: base ? base.portions : num(d.portions, 0, 30, 0),
      litres: base ? base.litres || 0 : num(d.litres, 0, 20, 0),
      ...(plausibleBb(d.bb) ? { bb: d.bb } : {}),
      // Older replies have no "seen": a date given then counts as read on every pack.
      seen: Math.round(num(d.seen, 0, 99, plausibleBb(d.bb) ? 99 : 0)),
    };
  });
}

/** Two entries are the same product when they share a catalogue id, or failing that a name and pack. */
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
export const productKey = (s: Pick<ScannedItem, "cat" | "name" | "pack">) => (s.cat ? `cat:${s.cat}|${words(s.pack)}` : `name:${words(s.name)}|${words(s.pack)}`);

const CONF_RANK = { low: 0, medium: 1, high: 2 } as const;

/**
 * For video scans: one pack filmed from several angles can come back as two entries. Entries for
 * the same product with the same date (or no date) are folded together, keeping the larger count
 * rather than adding, since adding would count one tin twice.
 */
export function mergeRepeats(items: ScannedItem[]): ScannedItem[] {
  const out: ScannedItem[] = [];
  const at = new Map<string, number>();
  for (const it of items) {
    const k = `${productKey(it)}|${it.bb || ""}`;
    const i = at.get(k);
    if (i === undefined) { at.set(k, out.length); out.push({ ...it }); continue; }
    const a = out[i];
    a.count = Math.max(a.count, it.count);
    a.seen = Math.max(a.seen, it.seen);
    if (CONF_RANK[it.conf] < CONF_RANK[a.conf]) a.conf = it.conf;
  }
  return out;
}

/**
 * Gives every scanned item a best-before date to review, and says where it came from:
 * read off the pack; read on some packs and assumed for the rest; taken from an identical
 * product where the date was seen (the earliest, so a reminder is never late); or, when no
 * matching pack showed one, a typical shelf life from today (shown, not saved).
 */
export function fillDates(items: ScannedItem[], today: string): ScannedItem[] {
  const dated = new Map<string, string>();
  const datedLoose = new Map<string, string>();
  const earliest = (m: Map<string, string>, k: string, bb: string) => { const v = m.get(k); if (!v || bb < v) m.set(k, bb); };
  for (const it of items) {
    if (!it.bb) continue;
    earliest(dated, productKey(it), it.bb);
    // Same catalogue product in a different pack size still shares a shelf life.
    if (it.cat) earliest(datedLoose, `cat:${it.cat}`, it.bb);
  }
  return items.map((it): ScannedItem => {
    const c = { ...it };
    delete c.from; delete c.guess;
    if (c.bb) c.from = c.seen > 0 && c.seen < c.count ? "some" : "read";
    else {
      const bb = dated.get(productKey(c)) || (c.cat ? datedLoose.get(`cat:${c.cat}`) : undefined);
      if (bb) { c.bb = bb; c.from = "match"; }
      else { c.from = "estimate"; c.guess = addMonths(today, shelfMonths(c)); }
    }
    return c;
  });
}

/** One line under the date in the review list, saying where the date came from. */
export function dateNote(s: ScannedItem): string {
  switch (s.from) {
    case "read": return s.count > 1 ? "Read off the packs" : "Read off the pack";
    case "some": return `Read on ${s.seen} of ${s.count}, same date used for the rest`;
    case "match": return "Not seen on these, so taken from a matching pack";
    case "estimate": return "No date seen, so estimated from the kind of food";
    case "you": return "Entered by you";
    default: return "";
  }
}
