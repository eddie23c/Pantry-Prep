import * as C from "../calc";
import { CAT, GROUPS } from "../data";
import { formatDate, kitCheckDue, todayIso } from "../dates";
import { fromCat, uid } from "../storage";
import { addItem, CountUp, fmt, GCOL, GroupDot, LEVEL_WORD, plural, RecipeCard, Ring, sortedRecipes } from "./common";
import { useApp } from "./appState";
import { UseSoon } from "./Rotate";

function Restock() {
  const { state, update, toast } = useApp();
  const list = state.restock || [];
  if (!list.length) return null;
  return (
    <>
      {list.map((r) => (
        <div className="row-item" key={"r" + r.uid}>
          <GroupDot group={r.group} tint={16}><span className="num">{r.count}×</span></GroupDot>
          <div className="row-main"><span className="t">{r.name}</span><span className="s">{r.pack ? `${r.pack} · ` : ""}Replaces what you used</span></div>
          <div className="use-acts">
            <button className="add-round" aria-label={`Mark ${r.name} as bought`} onClick={() => {
              update((s) => { C.dropRestock(s, r.uid); s.items.push({ ...r, uid: uid(), added: todayIso() }); });
              toast(`Logged ${r.count} × ${r.name}. Add its date from the Store tab`);
            }}>+</button>
            <button className="link-btn" aria-label={`Not replacing ${r.name}`} onClick={() => update((s) => { C.dropRestock(s, r.uid); })}>Skip</button>
          </div>
        </div>
      ))}
    </>
  );
}

/** How close the nearest recipe is, so an empty list shows progress rather than a dead end. */
function unlockLine(state: Parameters<typeof sortedRecipes>[0]) {
  const gaps = sortedRecipes(state).map((x) => x.s.req - x.s.have).filter((n) => n > 0);
  const n = gaps.length ? Math.min(...gaps) : 0;
  return n ? `${n === 1 ? "One more basic" : `${n} more basics`} and your first recipe unlocks.` : "Add a few more basics and recipes will appear here.";
}

export function Home() {
  const { state, update, go, openSheet, toast } = useApp();
  const t = C.totals(state.items), tg = C.targets(state.house), h = state.house, people = C.people(h);
  const d = C.daysCovered(state);
  const pct = d.days / h.days, lv = C.level(pct);
  const ringCol = lv === "ok" ? "var(--brass)" : lv === "warn" ? "#f5b65a" : "#f4946f";
  const togo = Math.max(0, tg.kcal - t.kcal);
  const minis = [
    { n: "Water", have: t.water, need: tg.water, u: "L", c: "var(--water)" },
    { n: "Protein", have: t.protein, need: tg.protein, u: "g", c: "var(--protein)" },
    { n: "Fibre", have: t.fibre, need: tg.fibre, u: "g", c: "var(--fibre)" },
  ];
  const shop = C.shoppingList(state);
  const kitDone = C.kitDone(state), kitAll = C.kitFor(state).length;
  const today = todayIso();
  const ready = sortedRecipes(state).filter((x) => x.s.ready);
  const kitNote = kitCheckDue(state.kitChecked, today) ? (state.kitChecked ? "Due a check" : "Not checked yet") : kitDone === kitAll ? "Complete" : `Checked ${formatDate(state.kitChecked!)}`;

  return (
    <>
      {state.example && <div className="banner"><b>You are looking at an example store.</b><span className="small">Clear it from the Store tab, then add your own food with the + button.</span></div>}
      <div className="card hero">
        <div className="card-head" style={{ width: "100%" }}><h2>Days covered</h2><span className={`status-chip st-${lv}`}>{LEVEL_WORD[lv]}</span></div>
        <div className="ring-wrap">
          <Ring pct={pct} color={ringCol} size={190} stroke={16} />
          <div className="ring-center"><span className="big num"><CountUp value={d.days} format={(n) => n.toFixed(1)} /></span><span className="lbl">of {plural(h.days, "day", "days")}</span></div>
        </div>
        <p className="small muted">{pct >= 1 ? `Food and water both last the full ${plural(h.days, "day", "days")}.` : `Your ${d.limiter} runs out first. Food lasts ${d.food.toFixed(1)} days, water ${d.water.toFixed(1)} days.`}</p>
        <div className="equation num">
          <div className="t"><span className="v">{fmt(tg.kcal)}</span><span className="k">Needed kcal</span></div><span className="op">−</span>
          <div className="t"><span className="v">{fmt(t.kcal)}</span><span className="k">In store</span></div><span className="op">=</span>
          <div className="t"><span className="v" style={{ color: togo ? "var(--energy-ink)" : "var(--fibre-ink)" }}>{fmt(togo)}</span><span className="k">To go</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Essentials</h2><button className="link-btn" onClick={() => openSheet({ kind: "about" })}>How we count</button></div>
        <div className="minis">
          {minis.map((m) => {
            const p = m.need ? m.have / m.need : 1;
            return (
              <div className="mini" key={m.n}>
                <div className="ring-wrap"><Ring pct={p} color={m.c} size={84} stroke={9} /><div className="ring-center"><span className="big num"><CountUp value={Math.min(999, p * 100)} format={(n) => `${Math.round(n)}%`} /></span></div></div>
                <span className="name">{m.n}</span><span className="of num">{fmt(m.have)} / {fmt(m.need)} {m.u}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Balanced plate</h2><span className="small muted">Eatwell groups</span></div>
        <div className="bars">
          {(["fruitveg", "starchy", "protein", "dairy"] as const).map((g) => {
            const need = GROUPS[g].perDay * people * h.days, have = t.groups[g], p = need ? have / need : 1;
            return (
              <div className="bar-row" key={g}>
                <div className="bar-top"><b>{GROUPS[g].label}</b><span className="num muted">{fmt(have)} / {fmt(need)} portions</span></div>
                <div className="bar"><i style={{ width: `${Math.min(100, p * 100).toFixed(1)}%`, background: GCOL[g] }} /></div>
              </div>
            );
          })}
        </div>
      </div>

      <UseSoon />

      <div className="card">
        <div className="card-head"><h2>Top up</h2><span className="small muted">{shop.length || state.restock?.length ? "Tap + when bought" : ""}</span></div>
        <div className="rows">
          <Restock />
          {shop.length ? shop.map((s) => {
            const c = CAT[s.id];
            return (
              <div className="row-item" key={s.id}>
                <GroupDot group={c.group} tint={16}><span className="num">{s.n}×</span></GroupDot>
                <div className="row-main"><span className="t">{c.name}</span><span className="s">{c.pack} · {s.why}</span></div>
                <button className="add-round" aria-label={`Mark ${c.name} as bought`} onClick={() => { update((st) => addItem(st, fromCat(s.id, s.n))); toast(`Logged ${s.n} × ${c.name}`); }}>+</button>
              </div>
            );
          }) : state.restock?.length ? null : <p className="empty-line">{h.days === 3 ? "Three" : h.days} days, sorted. Your store covers every target.</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Emergency kit</h2><button className="link-btn" onClick={() => go("prepare")}>Open checklist</button></div>
        <div className="bar-row">
          <div className="bar-top"><b>{kitDone} of {kitAll} Be Ready items</b><span className="muted small">{kitNote}</span></div>
          <div className="bar"><i style={{ width: `${(kitDone / kitAll * 100).toFixed(1)}%`, background: "var(--brand)" }} /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Cook from your store</h2><button className="link-btn" onClick={() => go("recipes")}>See all</button></div>
        {ready.length ? <div className="carousel">{ready.map((x) => <RecipeCard key={x.r.id} r={x.r} s={x.s} />)}</div> : <p className="empty-line">{unlockLine(state)}</p>}
      </div>
      <p className="small muted disclaimer">General guidance, not medical advice. <button className="link-btn" onClick={() => openSheet({ kind: "about" })}>How we count</button> · <button className="link-btn" onClick={() => openSheet({ kind: "feedback" })}>Send feedback</button></p>
    </>
  );
}

