// Pure calculations: targets, totals, days covered, shopping list and recipe matching.
// No DOM access here, so everything is unit tested in calc.test.ts.
import type { AllergenId, Diet } from "./allergens";
import { CAT, GROUPS, KIT, RECIPES, type GroupId, type KitItem, type Recipe } from "./data";

export interface House {
  adults: number;
  children: number;
  pets: number;
  days: number;
}

export interface StoreItem {
  uid: string;
  /** Catalogue id, or null for an item estimated by a photo scan. */
  cat: string | null;
  name: string;
  pack: string;
  group: GroupId;
  kind: string | null;
  kcal: number;
  protein: number;
  fibre: number;
  portions: number;
  litres: number;
  count: number;
  /** Best-before date as "YYYY-MM-DD", if the person entered one. */
  bb?: string;
  /** Barcode, for items added by scanning one. */
  code?: string;
}

export interface AppState {
  house: House;
  example: boolean;
  items: StoreItem[];
  picked: string[];
  /** Kit items ticked by hand ("hand") or seen in a photo ("photo"). */
  kit: Record<string, "hand" | "photo">;
  /** When the person last confirmed their kit, as "YYYY-MM-DD". */
  kitChecked?: string;
  /** Allergens to avoid in recipes. Kept on the phone only. */
  allergies: AllergenId[];
  diet: Diet;
  /** False until the person finishes the welcome screens. */
  onboarded: boolean;
  /** A baby or toddler lives here, so formula and nappies join the kit list. */
  baby?: boolean;
}

// Per person per day. Water is the UK Government Be Ready figure for drinking.
// Food figures are approximate UK reference intakes, pending review.
export const PER_DAY = {
  water: 3,
  adult: { kcal: 2000, protein: 50, fibre: 30 },
  child: { kcal: 1400, protein: 30, fibre: 20 },
};

export interface Totals {
  water: number;
  kcal: number;
  protein: number;
  fibre: number;
  packs: number;
  groups: Record<GroupId, number>;
}

export function people(h: House): number {
  return h.adults + h.children;
}

export function targets(h: House) {
  const d = h.days;
  return {
    water: people(h) * PER_DAY.water * d,
    kcal: (h.adults * PER_DAY.adult.kcal + h.children * PER_DAY.child.kcal) * d,
    protein: (h.adults * PER_DAY.adult.protein + h.children * PER_DAY.child.protein) * d,
    fibre: (h.adults * PER_DAY.adult.fibre + h.children * PER_DAY.child.fibre) * d,
  };
}

export function groupTarget(h: House, g: GroupId): number {
  return GROUPS[g].perDay * people(h) * h.days;
}

export function totals(items: StoreItem[]): Totals {
  const groups = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, 0])) as Record<GroupId, number>;
  const t: Totals = { water: 0, kcal: 0, protein: 0, fibre: 0, packs: 0, groups };
  for (const it of items) {
    t.water += (it.litres || 0) * it.count;
    t.kcal += it.kcal * it.count;
    t.protein += it.protein * it.count;
    t.fibre += it.fibre * it.count;
    t.packs += it.count;
    if (t.groups[it.group] != null) t.groups[it.group] += (it.portions || 0) * it.count;
  }
  return t;
}

/** How many days food and water each last, and the smaller of the two. */
export function daysCovered(state: AppState) {
  const h = state.house;
  const t = totals(state.items);
  const tg = targets(h);
  const kcalPerDay = tg.kcal / h.days;
  const food = kcalPerDay ? t.kcal / kcalPerDay : 0;
  const water = people(h) ? t.water / (people(h) * PER_DAY.water) : 0;
  return { food, water, days: Math.min(food, water), limiter: water < food ? "water" : "food" } as const;
}

export type Level = "ok" | "warn" | "bad";
export function level(fraction: number): Level {
  return fraction >= 1 ? "ok" : fraction >= 0.6 ? "warn" : "bad";
}

export function kindsHeld(items: StoreItem[]): Record<string, number> {
  const k: Record<string, number> = {};
  for (const it of items) if (it.kind && it.count > 0) k[it.kind] = (k[it.kind] || 0) + it.count;
  return k;
}

export interface ShopLine {
  id: string;
  n: number;
  why: string;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

/** What to buy to reach every target, preferring foods not already held. */
export function shoppingList(state: AppState): ShopLine[] {
  const h = state.house;
  const t = totals(state.items);
  const tg = targets(h);
  const list: ShopLine[] = [];
  const wGap = tg.water - t.water;
  if (wGap > 0) list.push({ id: "water5", n: Math.ceil(wGap / 5), why: `Closes the ${fmt(wGap)} L water gap` });
  const picks: Partial<Record<GroupId, string[]>> = {
    fruitveg: ["peaches", "peas", "apricots"],
    starchy: ["oats", "oatcakes", "wraps"],
    protein: ["chickpeas", "tuna", "nuts"],
    dairy: ["uht", "milkpowder", "ricepud"],
  };
  const held = kindsHeld(state.items);
  let added = 0;
  for (const g of ["fruitveg", "protein", "dairy", "starchy"] as GroupId[]) {
    const need = groupTarget(h, g) - t.groups[g];
    if (need <= 0) continue;
    const pick = picks[g]!.map((id) => CAT[id]).sort((a, b) => (held[a.kind] ? 1 : 0) - (held[b.kind] ? 1 : 0))[0];
    const n = Math.ceil(need / pick.portions);
    added += n * pick.kcal;
    list.push({ id: pick.id, n, why: `+${fmt(n * pick.portions)} ${GROUPS[g].label.toLowerCase()} portions` });
  }
  const kGap = tg.kcal - t.kcal - added;
  if (kGap > 0) list.push({ id: "pb", n: Math.ceil(kGap / CAT.pb.kcal), why: `Dense energy for the last ${fmt(kGap)} kcal` });
  return list;
}

export function recipeStatus(r: Recipe, items: StoreItem[]) {
  const held = kindsHeld(items);
  const req = r.ings.filter((i) => !i.opt);
  const have = req.filter((i) => i.k.some((k) => held[k])).length;
  return { req: req.length, have, ready: have === req.length, held };
}

export function sortedRecipes(items: StoreItem[]) {
  return RECIPES.map((r) => ({ r, s: recipeStatus(r, items) })).sort(
    (a, b) => b.s.have / b.s.req - a.s.have / a.s.req || a.s.req - b.s.req,
  );
}

export function kitState(k: KitItem, state: AppState): "auto" | "hand" | "photo" | null {
  if (k.auto) {
    const t = totals(state.items);
    const tg = targets(state.house);
    return (k.auto === "water" ? t.water >= tg.water : t.kcal >= tg.kcal) ? "auto" : null;
  }
  return state.kit[k.id] || null;
}

/** The kit items that apply to this home: pet and baby items only when they are needed. */
export function kitFor(state: AppState): KitItem[] {
  return KIT.filter((k) => !k.when || (k.when === "pets" ? state.house.pets > 0 : !!state.baby));
}

export function kitDone(state: AppState): number {
  return kitFor(state).filter((k) => kitState(k, state)).length;
}
