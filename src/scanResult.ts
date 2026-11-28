// Turning a photo-scan reply into store items and kit ticks. Pure, tested in scanResult.test.ts.
import { isIsoDate } from "./dates";
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
  /** Best-before date read off the pack, "YYYY-MM-DD". */
  bb?: string;
}

/** Prompt for scans that run inside Claude (no API key), which reply with free-form JSON. */
export function samplePrompt(): string {
  const cat = CATALOGUE.map((c) => `${c.id}: ${c.name} (${c.pack})`).join("\n");
  return "These photos show part of a UK household's emergency store. Do two things.\n\n1. List every food or drink product you can see.\n" +
    'For each distinct product give one entry. If it is the same kind of product as one of these catalogue items, set "id" to that catalogue id; otherwise set "id" to null and estimate nutrition for one pack from typical UK labels.\n\nCatalogue:\n' + cat + "\n\n" +
    `"kind" must be one of: ${Object.keys(KINDS).join(", ")}, or null.\n"group" must be one of: water, fruitveg, starchy, protein, dairy, oils, other.\n` +
    'Count every visible pack. If packs are stacked or partly hidden, give your best count and set confidence to "low".\n' +
    'If a best-before or use-by date is clearly legible, set "bb" to it as YYYY-MM-DD (month and year only: use the last day of that month; several dates: the earliest). Otherwise leave "bb" out. Never guess a date.\n\n' +
    "2. Say which of these emergency kit items are clearly visible (only include an id if you can actually see that item):\n" +
    KIT.filter((k) => k.look).map((k) => `${k.id}: ${k.look}`).join("\n") + "\n\n" +
    'Reply with only a JSON object like:\n{"food":[{"id":"tuna","name":"Tuna chunks in spring water","pack":"145 g tin","count":3,"kind":"fish","group":"protein","kcal":110,"protein":25,"fibre":0,"litres":0,"portions":1,"bb":"2028-03-31","confidence":"high"}],"kit":["torch","batteries"]}';
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
    };
  });
}
