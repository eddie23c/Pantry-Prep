// Everything is stored on the phone (localStorage). Nothing is sent to a server.
// Backup and restore use a JSON file the person keeps themselves.
import type { AppState, StoreItem } from "./calc";
import { CAT, EXAMPLE, GROUPS, type GroupId } from "./data";
import { isIsoDate } from "./dates";

const KEY = "pantry-prep-v1";
export const BACKUP_FORMAT = "pantry-prep-backup";

let uidN = 0;
export function uid(): string {
  uidN += 1;
  return "i" + Date.now().toString(36) + uidN;
}

export function fromCat(id: string, count: number): StoreItem {
  const c = CAT[id];
  return {
    uid: uid(), cat: id, name: c.name, pack: c.pack, group: c.group, kind: c.kind,
    kcal: c.kcal, protein: c.protein, fibre: c.fibre, portions: c.portions, litres: c.litres || 0, count,
  };
}

export function defaultState(): AppState {
  return {
    house: { adults: 2, children: 1, pets: 0, days: 3 },
    example: true,
    items: EXAMPLE.map(([id, n]) => fromCat(id, n)),
    picked: ["r1", "r4", "r9"],
    kit: {},
  };
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : d));
};

/** Accepts anything (a stored value or an imported file) and returns a safe state, or null. */
export function sanitise(raw: unknown): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, any>;
  if (!Array.isArray(s.items) || !s.house || typeof s.house !== "object") return null;
  const items: StoreItem[] = s.items.slice(0, 500).flatMap((it: any): StoreItem[] => {
    if (!it || typeof it !== "object") return [];
    const group: GroupId = it.group in GROUPS ? it.group : "other";
    return [{
      uid: typeof it.uid === "string" ? it.uid.slice(0, 40) : uid(),
      cat: typeof it.cat === "string" && CAT[it.cat] ? it.cat : null,
      name: String(it.name ?? "Item").slice(0, 80),
      pack: String(it.pack ?? "").slice(0, 30),
      group,
      kind: typeof it.kind === "string" ? it.kind.slice(0, 30) : null,
      kcal: clamp(it.kcal, 0, 10000, 0),
      protein: clamp(it.protein, 0, 1000, 0),
      fibre: clamp(it.fibre, 0, 500, 0),
      portions: clamp(it.portions, 0, 100, 0),
      litres: clamp(it.litres, 0, 50, 0),
      count: Math.round(clamp(it.count, 1, 999, 1)),
      ...(isIsoDate(it.bb) ? { bb: it.bb } : {}),
      ...(typeof it.code === "string" && /^\d{8,14}$/.test(it.code) ? { code: it.code } : {}),
    }];
  });
  const kit: AppState["kit"] = {};
  if (s.kit && typeof s.kit === "object") {
    for (const [k, v] of Object.entries(s.kit)) if (v === "hand" || v === "photo") kit[k.slice(0, 30)] = v;
  }
  const house = {
    adults: Math.round(clamp(s.house.adults, 0, 20, 2)),
    children: Math.round(clamp(s.house.children, 0, 20, 0)),
    pets: Math.round(clamp(s.house.pets, 0, 20, 0)),
    days: Math.round(clamp(s.house.days, 1, 30, 3)),
  };
  if (house.adults + house.children === 0) house.adults = 1;
  return {
    house,
    example: Boolean(s.example),
    items,
    picked: Array.isArray(s.picked) ? s.picked.filter((x: unknown) => typeof x === "string").slice(0, 100) : [],
    kit,
    ...(isIsoDate(s.kitChecked) ? { kitChecked: s.kitChecked } : {}),
  };
}

export function load(): AppState | null {
  try {
    return sanitise(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return null;
  }
}

export function save(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: the app keeps working for this visit */
  }
}

export function toBackup(state: AppState): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, savedAt: new Date().toISOString(), state }, null, 2);
}

export function fromBackup(text: string): AppState | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.format !== BACKUP_FORMAT) return null;
    return sanitise(parsed.state);
  } catch {
    return null;
  }
}
