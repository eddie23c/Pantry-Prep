// Small shared pieces: number formatting, colours per food group, rings, steppers, recipe cards.
import type { ReactNode } from "react";
import { unsuitable } from "../allergens";
import * as C from "../calc";
import type { AppState, StoreItem } from "../calc";
import { KINDS, RECIPES, type GroupId, type Ingredient, type Recipe } from "../data";
import { useApp } from "./appState";

export const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const ingLabel = (i: Ingredient) => i.k.map((k) => KINDS[k]).join(" or ");

export const GCOL: Record<GroupId, string> = { water: "var(--water)", fruitveg: "var(--fibre)", starchy: "var(--warn)", protein: "var(--protein)", dairy: "var(--water)", oils: "var(--energy)", other: "var(--muted)" };
// Darker text versions of GCOL, for labels on tinted chips (contrast 4.5:1).
export const GINK: Record<GroupId, string> = { water: "var(--water-ink)", fruitveg: "var(--fibre-ink)", starchy: "var(--warn-ink)", protein: "var(--protein-ink)", dairy: "var(--water-ink)", oils: "var(--energy-ink)", other: "var(--muted)" };
export const GSHORT: Record<GroupId, string> = { water: "H₂O", fruitveg: "FV", starchy: "SC", protein: "PR", dairy: "DA", oils: "OI", other: "EX" };
export const LEVEL_WORD = { ok: "On track", warn: "Nearly there", bad: "Short" };

export function GroupDot({ group, children, tint = 15 }: { group: GroupId; children: ReactNode; tint?: number }) {
  return <div className="dot" style={{ background: `color-mix(in srgb,${GCOL[group]} ${tint}%,transparent)`, color: GINK[group] }}>{children}</div>;
}

export function Ring({ pct, color, size, stroke }: { pct: number; color: string; size: number; stroke: number }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
      <circle className="ring-fg" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - p)).toFixed(1)} />
    </svg>
  );
}

export function Stepper({ value, onStep, less, more }: { value: number; onStep: (d: number) => void; less: string; more: string }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onStep(-1)} aria-label={less}>−</button>
      <span className="num">{value}</span>
      <button type="button" onClick={() => onStep(1)} aria-label={more}>+</button>
    </div>
  );
}

/** Why a recipe doesn't suit the household's allergies or diet, or null. */
export const whyNot = (r: Recipe, s: AppState) => unsuitable(r, s.allergies, s.diet);

export function sortedRecipes(s: AppState, all = false) {
  return C.sortedRecipes(s.items).filter((x) => all || !whyNot(x.r, s));
}
export const pickedRecipes = (s: AppState) => RECIPES.filter((r) => s.picked.includes(r.id));

export function MatchBadge({ s }: { s: { ready: boolean; have: number; req: number } }) {
  const l = s.ready ? "ok" : s.have / s.req >= 0.5 ? "warn" : "bad";
  return <span className={`match st-${l}`}>{s.ready ? "✓ Ready" : `${s.have} of ${s.req}`}</span>;
}

export function RecipeCard({ r, s }: { r: Recipe; s: ReturnType<typeof C.recipeStatus> }) {
  const { state, openSheet } = useApp();
  const on = state.picked.includes(r.id);
  const why = whyNot(r, state);
  return (
    <button className="rcard" data-recipe={r.id} onClick={() => openSheet({ kind: "recipe", id: r.id })}>
      <div className="rcard-top"><h3>{r.title}</h3><MatchBadge s={s} /></div>
      <div className="meta"><span>Serves {r.serves}</span><span>{r.cook ? "Camping stove" : "No cooking"}</span>{on && <span className="on-list">On print list</span>}</div>
      <div className="ings">
        {r.ings.filter((i) => !i.opt).map((i, n) => {
          const got = i.k.some((k) => s.held[k]);
          return <span key={n} className={`ing ${got ? "have" : "miss"}`}>{ingLabel(i)}</span>;
        })}
      </div>
      {why && <p className="small warn-text">{why}</p>}
    </button>
  );
}

/** Adds an item, merging with a matching row (same catalogue item, name and best-before date). */
export function addItem(s: AppState, item: StoreItem) {
  const ex = item.cat && s.items.find((x) => x.cat === item.cat && x.name === item.name && (x.bb || "") === (item.bb || ""));
  if (ex) ex.count += item.count;
  else s.items.push(item);
}
