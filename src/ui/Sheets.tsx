// Bottom sheets: the shell (focus, Escape, scrim) and the simple sheets that go in it.
import { useEffect, useRef, type ReactNode } from "react";
import { ALLERGENS, recipeAllergens } from "../allergens";
import * as C from "../calc";
import { RECIPES, type Recipe } from "../data";
import { expiryPhrase, expiryStatus, isIsoDate, SOON_DAYS, todayIso } from "../dates";
import { LEGAL, type LegalPage } from "../legal";
import { AllergyPicker } from "./AllergyPicker";
import { fmt, ingLabel, MatchBadge, Stepper, whyNot } from "./common";
import { useApp } from "./appState";

export function Sheet({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  const { closeSheet } = useApp();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => close.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (back && back.isConnected) back.focus();
    };
  }, [closeSheet]);
  return (
    <>
      <div className="scrim" onClick={closeSheet} />
      <div className="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h">
        <div className="sheet-head">
          <div className="grab" />
          <div className="sheet-title"><h2 id="sheet-h">{title}</h2><button className="close" id="sheet-close" ref={close} aria-label="Close" onClick={closeSheet}>✕</button></div>
          {extra && <div id="sheet-extra">{extra}</div>}
        </div>
        <div className="sheet-body" id="sheet-body">{children}</div>
      </div>
    </>
  );
}

function AllergenCard({ r }: { r: Recipe }) {
  const { state } = useApp();
  const list = recipeAllergens(r), why = whyNot(r, state);
  return (
    <div className="card">
      <h2 style={{ fontSize: "1rem" }}>Allergens</h2>
      {why && <p className="warn-text small">{why}.</p>}
      <p className="small">
        {list.length ? `May contain: ${list.map((a) => ALLERGENS[a].toLowerCase()).join(", ")}.` : "None of the 14 major allergens is usual in these ingredients."}{" "}
        <span className="muted">Brands differ, so always check the label.</span>
      </p>
    </div>
  );
}

export function RecipeSheet({ id }: { id: string }) {
  const { state, update, toast } = useApp();
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return null;
  const s = C.recipeStatus(r, state.items), on = state.picked.includes(r.id);
  return (
    <Sheet title={r.title}>
      <div className="meta"><MatchBadge s={s} /><span>Serves {r.serves}</span><span>{r.cook ? `Camping stove${r.water ? `, ${r.water} L water` : ""}` : "No cooking"}</span></div>
      <div className="card">
        <h2 style={{ fontSize: "1rem" }}>You need</h2>
        <ul className="need-list">
          {r.ings.map((i, n) => {
            const got = i.k.some((k) => s.held[k]);
            return <li key={n}><span>{ingLabel(i)} <span className="muted small">{i.q}</span></span><span className={`ing ${got ? "have" : i.opt ? "" : "miss"}`}>{got ? "In store" : i.opt ? "Optional" : "Need"}</span></li>;
          })}
        </ul>
      </div>
      <AllergenCard r={r} />
      <div className="card"><h2 style={{ fontSize: "1rem" }}>Method</h2><ol className="steps-list">{r.steps.map((st, n) => <li key={n}>{st}</li>)}</ol></div>
      <button className={`btn ${on ? "" : "primary"} block`} onClick={() => {
        update((st) => { st.picked = st.picked.filter((x) => x !== r.id); if (!on) st.picked.push(r.id); });
        toast(on ? "Removed from print cards" : "Added to print cards");
      }}>{on ? "Remove from print cards" : "Add to print cards"}</button>
    </Sheet>
  );
}

export function ItemSheet({ id }: { id: string }) {
  const { state, update, closeSheet, toast } = useApp();
  const it = state.items.find((x) => x.uid === id);
  useEffect(() => { if (!it) closeSheet(); }, [it, closeSheet]);
  if (!it) return null;
  const today = todayIso();
  const total = it.group === "water" ? `${fmt(it.litres * it.count)} L` : `${fmt(it.kcal * it.count)} kcal`;
  const edit = (fn: (x: C.StoreItem) => void) => update((s) => { const x = s.items.find((y) => y.uid === id); if (x) fn(x); });
  return (
    <Sheet title={it.name}>
      <div className="card" data-uid={it.uid}>
        <div className="set-row">
          <div className="row-main"><span className="t">How many</span><span className="s num">{it.pack || "Pack"} · {total} in total</span></div>
          <Stepper value={it.count} less="One fewer" more="One more" onStep={(d) => update((s) => {
            const x = s.items.find((y) => y.uid === id);
            if (!x) return;
            x.count += d;
            if (x.count <= 0) s.items = s.items.filter((y) => y !== x);
          })} />
        </div>
        <label className="field" htmlFor="bb-input">
          <span className="t">Best-before date</span>
          <span className="s">Use the earliest date if your packs differ. We remind you {SOON_DAYS} days ahead.</span>
          <input type="date" id="bb-input" value={it.bb || ""} onChange={(e) => { const v = e.target.value; edit((x) => { if (isIsoDate(v)) x.bb = v; else delete x.bb; }); }} />
        </label>
        {it.bb && <p className={`small ${expiryStatus(it.bb, today) === "ok" ? "muted" : "warn-text"}`}>{expiryPhrase(it.bb, today)}</p>}
      </div>
      <div className="card">
        <p className="small muted num">Per pack: {it.group === "water" ? `${fmt(it.litres)} L water` : `${fmt(it.kcal)} kcal, ${fmt(it.protein)} g protein, ${fmt(it.fibre)} g fibre`}.{it.cat ? " Typical UK label figure." : " Estimated, so check the pack."}</p>
      </div>
      <button className="btn danger block" onClick={() => { const name = it.name; closeSheet(); update((s) => { s.items = s.items.filter((x) => x.uid !== id); }); toast(`Removed ${name}`); }}>Remove from store</button>
    </Sheet>
  );
}

export function AboutSheet() {
  const { state } = useApp();
  const tg = C.targets(state.house);
  return (
    <Sheet title="How we count">
      <div className="card">
        <p><b>Water</b> uses the UK Government figure: 3 litres per person per day for drinking. Plan more for cooking, washing, baby formula and pets.</p>
        <p><b>Food</b> targets are approximate UK reference intakes for a short emergency: 2,000 kcal, 50 g protein and 30 g fibre per adult per day, and about 1,400 kcal, 30 g protein and 20 g fibre per child.</p>
        <p><b>Balanced plate</b> follows the Eatwell Guide groups: 5 portions of fruit and veg, 3 of starchy carbs, 2 of protein and 2 of dairy per person per day.</p>
        <p className="small muted num">Your household needs {fmt(tg.water)} L water and {fmt(tg.kcal)} kcal in total. Nutrition per pack is a typical label figure, and scanned items are estimates.</p>
      </div>
    </Sheet>
  );
}

export function DietSheet() {
  const { state, update, closeSheet } = useApp();
  return (
    <Sheet title="Allergies and diet">
      <p className="small muted">We hide recipes that may contain these. This stays on your phone and is never sent anywhere.</p>
      <div className="card"><AllergyPicker state={state} onChange={update} /></div>
      <button className="btn primary block" onClick={closeSheet}>Done</button>
    </Sheet>
  );
}

export function LegalSheet({ page }: { page: string }) {
  const doc = LEGAL[page as LegalPage];
  if (!doc) return null;
  // The legal text is our own static HTML from legal.ts, not user input.
  return <Sheet title={doc.title}><div className="card legal" dangerouslySetInnerHTML={{ __html: doc.html }} /></Sheet>;
}
