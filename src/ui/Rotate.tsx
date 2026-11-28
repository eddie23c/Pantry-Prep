// "Use this month": everything to eat and rotate out in the next 30 days, as a card on the
// dashboard and a full page (sheet) grouped by week. Used puts an item on the shopping list,
// Replaced marks it as freshly bought.
import * as C from "../calc";
import { expiryPhrase, rotatePlan, SOON_DAYS, todayIso, type Due } from "../dates";
import { plural } from "./common";
import { Sheet } from "./Sheets";
import { useApp } from "./appState";

/** How many items need eating within the month, and whether any are already past their date. */
export function useRotateCount() {
  const { state } = useApp();
  const plan = rotatePlan(state.items, todayIso());
  return { count: plan.reduce((n, g) => n + g.items.length, 0), past: plan.some((g) => g.id === "past") };
}

export function DueRow({ d }: { d: Due }) {
  const { state, update, openSheet, toast } = useApp();
  const today = todayIso(), it = d.item;
  const tone = d.status === "expired" ? "bad" : "warn";
  const used = () => {
    const at = state.items.findIndex((x) => x.uid === it.uid);
    if (at < 0) return;
    update((s) => { C.eatUp(s, it.uid); });
    toast(`${it.name} is on your shopping list`, { label: "Undo", run: () => update((s) => { C.restoreEaten(s, it, at); }) });
  };
  const fresh = () => {
    update((s) => { const x = s.items.find((y) => y.uid === it.uid); if (x) { delete x.bb; x.added = today; } });
    toast("Marked as fresh. Add the new date for an exact reminder", { label: "Add date", run: () => openSheet({ kind: "item", id: it.uid }) });
  };
  return (
    <div className="row-item use-row">
      <div className="dot" aria-hidden="true" style={{ background: `color-mix(in srgb,var(--${tone}) 15%,transparent)`, color: `var(--${tone}-ink)` }}>!</div>
      <button className="row-main row-btn" data-item={it.uid} onClick={() => openSheet({ kind: "item", id: it.uid })}>
        <span className="t">{it.count > 1 ? `${it.count} × ` : ""}{it.name}</span><span className="s">{expiryPhrase(d.date, today, d.estimated)}</span>
      </button>
      <div className="use-acts">
        <button className="btn small-btn" aria-label={`Used ${it.name}, add to shopping list`} onClick={used}>Used</button>
        <button className="btn small-btn" aria-label={`Replaced ${it.name} with a fresh one`} onClick={fresh}>Replaced</button>
      </div>
    </div>
  );
}

/** Dashboard card: the first few, and a way into the full page. */
export function UseSoon() {
  const { state, openSheet } = useApp();
  const plan = rotatePlan(state.items, todayIso());
  const all = plan.flatMap((g) => g.items);
  if (!all.length) return null;
  const past = plan.some((g) => g.id === "past");
  const SHOW = 3;
  return (
    <div className="card" id="use-soon">
      <div className="card-head"><h2>Use this month</h2><span className={`status-chip st-${past ? "bad" : "warn"}`}>{plural(all.length, "item", "items")}</span></div>
      <p className="small muted">Eat these in normal meals over the next {SOON_DAYS} days and buy fresh ones. Tap Used and it goes on your shopping list.</p>
      <div className="rows">{all.slice(0, SHOW).map((d) => <DueRow d={d} key={d.item.uid} />)}</div>
      <button className="btn block" id="rotate-btn" onClick={() => openSheet({ kind: "rotate" })}>
        {all.length > SHOW ? `See all ${all.length} by week` : "See the month by week"}
      </button>
    </div>
  );
}

/** Full page: everything due in the next 30 days, by week. */
export function RotateSheet() {
  const { state } = useApp();
  const plan = rotatePlan(state.items, todayIso());
  const total = plan.reduce((n, g) => n + g.items.length, 0);
  const tracked = state.items.filter((it) => it.bb || it.added).length;
  return (
    <Sheet title="Use this month">
      <p className="small muted">
        {total ? `${plural(total, "item needs", "items need")} eating and replacing in the next ${SOON_DAYS} days. Work them into meals, then buy fresh ones so your store stays full.` : `Nothing needs eating in the next ${SOON_DAYS} days.`}
        {tracked < state.items.length ? ` ${plural(state.items.length - tracked, "item has", "items have")} no date yet, so ${state.items.length - tracked === 1 ? "it isn't" : "they aren't"} listed.` : ""}
      </p>
      {plan.map((g) => (
        <div className="card rotate-group" key={g.id} data-group={g.id}>
          <div className="card-head"><h2>{g.label}</h2><span className="small muted num">{plural(g.items.length, "item", "items")}</span></div>
          <div className="rows">{g.items.map((d) => <DueRow d={d} key={d.item.uid} />)}</div>
        </div>
      ))}
      {!total && <div className="card"><p className="empty-line">All clear. We'll list things here a month before their date.</p></div>}
    </Sheet>
  );
}
