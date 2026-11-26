import { useState } from "react";
import * as C from "../calc";
import type { StoreItem } from "../calc";
import { GROUP_ORDER, GROUPS } from "../data";
import { expiryStatus, todayIso } from "../dates";
import { fmt, GCOL, GroupDot, GSHORT } from "./common";
import { useApp } from "./appState";

function BbTag({ it }: { it: StoreItem }) {
  const st = expiryStatus(it.bb, todayIso());
  if (!st || st === "ok") return null;
  return <span className={`tag tag-${st}`}>{st === "expired" ? "Past date" : "Use soon"}</span>;
}

export function Store() {
  const { state, update, openSheet, toast } = useApp();
  const [askClear, setAskClear] = useState(false);
  const t = C.totals(state.items);
  const by: Partial<Record<string, StoreItem[]>> = {};
  for (const it of state.items) (by[it.group] = by[it.group] || []).push(it);

  const step = (uid: string, d: number) =>
    update((s) => {
      const it = s.items.find((x) => x.uid === uid);
      if (!it) return;
      it.count += d;
      if (it.count <= 0) s.items = s.items.filter((x) => x !== it);
    });

  return (
    <>
      {state.example && (
        <div className="banner" id="clear-box">
          <b>This is an example store.</b><span className="small">Clear it to start logging your own food.</span>
          <div className="acts">
            {askClear ? (
              <>
                <span className="small"><b>Remove every example item?</b></span>
                <button className="btn danger" onClick={() => { update((s) => { s.items = []; s.example = false; s.picked = []; }); setAskClear(false); toast("Example cleared. Tap + to add your food."); }}>Clear</button>
                <button className="btn" onClick={() => setAskClear(false)}>Keep</button>
              </>
            ) : <button className="btn" onClick={() => setAskClear(true)}>Clear example</button>}
          </div>
        </div>
      )}
      <div className="card">
        <div className="summary-strip num">
          <div><span className="v">{fmt(t.packs)}</span><span className="k">Packs</span></div>
          <div><span className="v">{fmt(t.kcal)}</span><span className="k">kcal</span></div>
          <div><span className="v">{fmt(t.water)} L</span><span className="k">Water</span></div>
        </div>
      </div>
      {GROUP_ORDER.map((g) => {
        const list = by[g] || [];
        if (!list.length && (g === "oils" || g === "other")) return null;
        const sub = g === "water" ? `${fmt(list.reduce((a, it) => a + it.litres * it.count, 0))} L` : `${fmt(list.reduce((a, it) => a + it.kcal * it.count, 0))} kcal`;
        return (
          <div className="card section-card" key={g}>
            <div className="section-head"><h3><span className="swatch" style={{ background: GCOL[g] }} />{GROUPS[g].label}</h3><span className="small muted num">{sub}</span></div>
            <div className="section-body rows">
              {!list.length && <p className="empty-line">Nothing here yet.</p>}
              {list.map((it) => (
                <div className="row-item" data-uid={it.uid} key={it.uid}>
                  <GroupDot group={g}>{GSHORT[g]}</GroupDot>
                  <button className="row-main row-btn" data-item={it.uid} onClick={() => openSheet({ kind: "item", id: it.uid })}>
                    <span className="t">{it.name}{!it.cat && !it.code && <span className="tag">estimate</span>}<BbTag it={it} /></span>
                    <span className="s num">{it.pack}{it.pack ? " · " : ""}{g === "water" ? `${fmt(it.litres * it.count)} L` : `${fmt(it.kcal * it.count)} kcal`}</span>
                  </button>
                  <div className="stepper">
                    <button onClick={() => step(it.uid, -1)} aria-label={`One fewer ${it.name}`}>−</button>
                    <span className="num">{it.count}</span>
                    <button onClick={() => step(it.uid, 1)} aria-label={`One more ${it.name}`}>+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="section-foot"><button className="link-btn" onClick={() => openSheet({ kind: "add", group: g, mode: "search" })}>+ Add {GROUPS[g].label.toLowerCase()}</button></div>
          </div>
        );
      })}
    </>
  );
}
