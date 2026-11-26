// Open Food Facts: turn a product record into a store item.
// Open Food Facts is a free, open database of food products (ODbL licence).
// Pure functions only, tested in off.test.ts. The network call lives in barcode.ts.
import type { GroupId } from "./data";

export interface OffProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  categories_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
}

export interface BarcodeDraft {
  code: string;
  name: string;
  pack: string;
  group: GroupId;
  kind: string | null;
  kcal: number;
  protein: number;
  fibre: number;
  portions: number;
  litres: number;
  /** True when the pack size was missing, so per-pack figures assume 100 g. */
  guessedSize: boolean;
}

/** EAN-13, EAN-8, UPC-A and UPC-E: 8 to 14 digits. */
export function isBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code);
}

/** Checks the GS1 check digit, which catches most mistyped numbers. */
export function validCheckDigit(code: string): boolean {
  if (!isBarcode(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

// Order matters: the first rule whose tag appears wins, so specific tags come first.
const RULES: [tags: string[], group: GroupId, kind: string | null][] = [
  [["en:waters", "en:spring-waters", "en:mineral-waters", "en:still-waters"], "water", "water"],
  [["en:baked-beans"], "protein", "beans"],
  [["en:canned-fishes", "en:tunas", "en:sardines", "en:mackerels", "en:canned-tunas", "en:salmons", "en:fishes"], "protein", "fish"],
  [["en:corned-beef", "en:canned-meats", "en:canned-chicken", "en:meats"], "protein", "meat"],
  [["en:chickpeas", "en:lentils", "en:kidney-beans", "en:canned-legumes", "en:legumes", "en:pulses", "en:beans"], "protein", "pulses"],
  [["en:peanut-butters", "en:nut-butters", "en:spreads-of-nuts"], "protein", "nutbutter"],
  [["en:nuts", "en:mixed-nuts", "en:seeds", "en:peanuts"], "protein", "nuts"],
  [["en:soups"], "fruitveg", "soup"],
  [["en:canned-tomatoes", "en:chopped-tomatoes", "en:tomatoes"], "fruitveg", "tomatoes"],
  [["en:canned-potatoes"], "starchy", "potatoes"],
  [["en:dried-fruits", "en:raisins", "en:dried-apricots"], "fruitveg", "driedfruit"],
  [["en:fruit-juices", "en:juices", "en:orange-juices"], "fruitveg", "juice"],
  [["en:canned-fruits", "en:fruits-in-syrup", "en:fruits-in-juice"], "fruitveg", "fruit"],
  [["en:canned-vegetables", "en:sweetcorn", "en:peas", "en:carrots", "en:vegetables"], "fruitveg", "veg"],
  [["en:rice-puddings", "en:custards", "en:dairy-desserts"], "dairy", "pudding"],
  [["en:milks", "en:uht-milks", "en:plant-based-milk-alternatives", "en:milk-powders"], "dairy", "milk"],
  [["en:instant-noodles", "en:noodles"], "starchy", "noodles"],
  [["en:oat-flakes", "en:rolled-oats", "en:porridges", "en:porridge-oats"], "starchy", "oats"],
  [["en:crackers", "en:oatcakes", "en:crispbreads", "en:rice-cakes"], "starchy", "crackers"],
  [["en:breakfast-cereals"], "starchy", "cereal"],
  [["en:wraps", "en:tortillas", "en:flatbreads"], "starchy", "wraps"],
  [["en:pastas", "en:dry-pastas"], "starchy", "pasta"],
  [["en:rices", "en:cooked-rices"], "starchy", "rice"],
  [["en:vegetable-oils", "en:olive-oils", "en:oils"], "oils", "oil"],
  [["en:honeys", "en:jams", "en:fruit-preserves", "en:marmalades"], "other", "honey"],
  [["en:cereal-bars", "en:chocolates", "en:biscuits", "en:snacks", "en:confectioneries"], "other", "snack"],
];

// Grams (or ml) in one Eatwell-style portion, calibrated against the built-in catalogue.
const PORTION: Record<string, number> = {
  fish: 140, meat: 85, beans: 200, pulses: 200, nutbutter: 34, nuts: 33, soup: 200, tomatoes: 100,
  potatoes: 190, driedfruit: 30, juice: 330, fruit: 135, veg: 100, pudding: 200, milk: 200,
  noodles: 85, oats: 40, crackers: 31, cereal: 40, wraps: 60, pasta: 83, rice: 125,
};

export function classify(tags: string[] = []): { group: GroupId; kind: string | null } {
  const set = new Set(tags);
  for (const [ruleTags, group, kind] of RULES) if (ruleTags.some((t) => set.has(t))) return { group, kind };
  return { group: "other", kind: null };
}

const n = (v: unknown) => {
  const x = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(x) && x >= 0 ? x : 0;
};

/** Pack size in grams or millilitres, from the structured field or the label text ("4 x 400 g"). */
export function packSize(p: OffProduct): number {
  const q = n(p.product_quantity);
  const unit = (p.product_quantity_unit || "g").toLowerCase();
  if (q > 0) return unit === "kg" || unit === "l" ? q * 1000 : unit === "cl" ? q * 10 : q;
  const m = (p.quantity || "").toLowerCase().replace(",", ".").match(/(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)\b/);
  if (!m) return 0;
  const mult = m[1] ? Number(m[1]) : 1;
  const unitMult = ({ kg: 1000, l: 1000, cl: 10 } as Record<string, number>)[m[3]] ?? 1;
  return mult * Number(m[2]) * unitMult;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function toDraft(code: string, p: OffProduct): BarcodeDraft {
  const { group, kind } = classify(p.categories_tags);
  const size = packSize(p);
  const grams = size || 100;
  const nt = p.nutriments || {};
  let kcal100 = n(nt["energy-kcal_100g"]);
  if (!kcal100 && n(nt["energy_100g"])) kcal100 = n(nt["energy_100g"]) / 4.184; // kJ to kcal
  const per = (v: number) => Math.round((v * grams) / 100);
  const name = [p.brands?.split(",")[0]?.trim(), (p.product_name_en || p.product_name || "").trim()].filter(Boolean).join(" ") || "Scanned product";
  const portionG = kind ? PORTION[kind] : 0;
  return {
    code,
    name: name.slice(0, 80),
    pack: (p.quantity || (size ? `${size} g` : "")).slice(0, 30),
    group,
    kind,
    kcal: group === "water" ? 0 : per(kcal100),
    protein: group === "water" ? 0 : per(n(nt["proteins_100g"])),
    fibre: group === "water" ? 0 : per(n(nt["fiber_100g"])),
    portions: portionG ? Math.max(1, Math.round(grams / portionG)) : 0,
    litres: group === "water" ? r1(grams / 1000) : 0,
    guessedSize: !size,
  };
}
