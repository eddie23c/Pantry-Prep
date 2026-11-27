import { useRef, useState } from "react";
import * as C from "../calc";
import type { House } from "../calc";
import { KIT, LINKS } from "../data";
import { formatDate, kitCheckDue, todayIso } from "../dates";
import { buildPrintFile } from "../print";
import { getApiKey, looksLikeKey, SCAN_URL, setApiKey } from "../scan";
import { fromBackup, toBackup } from "../storage";
import { allergySummary } from "./AllergyPicker";
import { pickedRecipes, plural, sortedRecipes, Stepper } from "./common";
import { openPrintable, saveFile } from "./files";
import { useApp } from "./appState";

function HouseRow({ k, label, sub }: { k: keyof House; label: string; sub: string }) {
  const { state, update } = useApp();
  const lim = k === "days" ? [1, 30] : [0, 20];
  return (
    <div className="set-row">
      <div className="row-main"><span className="t">{label}</span><span className="s">{sub}</span></div>
      <Stepper value={state.house[k]} less={`Fewer ${label}`} more={`More ${label}`}
        onStep={(d) => update((s) => {
          s.house[k] = Math.min(lim[1], Math.max(lim[0], s.house[k] + d));
          if (C.people(s.house) === 0) s.house.adults = 1;
        })} />
    </div>
  );
}

function KitCard() {
  const { state, update, openSheet, toast } = useApp();
  const done = C.kitDone(state);
  const due = kitCheckDue(state.kitChecked, todayIso());
  return (
    <div className="card">
      <div className="card-head"><h2>Be Ready kit</h2><span className="small muted num">{done} of {KIT.length}</span></div>
      <p className="small muted">From the UK Government checklist. Items tick themselves when your store covers them or a photo shows them. Tick the rest by hand.</p>
      <div className="bar"><i style={{ width: `${(done / KIT.length * 100).toFixed(1)}%`, background: "var(--brand)" }} /></div>
      <ul className="check-list">
        {KIT.map((k) => {
          const st = C.kitState(k, state);
          return (
            <li key={k.id}>
              <label htmlFor={`kit-${k.id}`}>
                <input type="checkbox" id={`kit-${k.id}`} checked={!!st} disabled={!!k.auto}
                  onChange={(e) => { const on = e.target.checked; update((s) => { if (on) s.kit[k.id] = "hand"; else delete s.kit[k.id]; }); }} />
                <span>{k.label}{st === "auto" && <span className="tag">From your store</span>}{st === "photo" && <span className="tag tag-photo">Seen in photo</span>}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className={`kit-check${due ? " due" : ""}`}>
        <div className="row-main">
          <span className="t">{state.kitChecked ? `Last checked ${formatDate(state.kitChecked)}` : "Not checked yet"}</span>
          <span className="s">{due ? "Look through your kit every 3 months: test torches and radios, swap old batteries and medicines." : "Next check due in about 3 months."}</span>
        </div>
        <button className={`btn${due ? " primary" : ""}`} id="kit-checked-btn" onClick={() => { update((s) => { s.kitChecked = todayIso(); }); toast("Kit check saved"); }}>I checked it today</button>
      </div>
      <button className="btn block" onClick={() => openSheet({ kind: "add", mode: "scan" })}>Photograph my kit</button>
    </div>
  );
}

export function KeyCard() {
  const { toast } = useApp();
  const [key, setKey] = useState(getApiKey);
  const [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const keyForm = key ? (
    <div className="set-row">
      <div className="row-main"><span className="t">Key saved</span><span className="s num">sk-ant-…{key.slice(-4)}</span></div>
      <button className="btn danger" onClick={() => { setApiKey(""); setKey(""); toast("API key removed from this device"); }}>Remove</button>
    </div>
  ) : (
    <>
      <label className="search" htmlFor="key-input"><input ref={input} id="key-input" type="password" autoComplete="off" spellCheck={false} placeholder="Paste your API key (sk-ant-…)" aria-label="Anthropic API key" /></label>
      <button className="btn primary block" onClick={() => {
        const v = (input.current?.value || "").trim();
        if (!looksLikeKey(v)) { setStatus("That doesn't look like an Anthropic API key. It starts with sk-ant-."); return; }
        setApiKey(v); setKey(v); setStatus(""); toast("Photo scanning now uses your key");
      }}>Save key</button>
      <p className="small muted">Get a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. Set a monthly spend limit there to stay in control.</p>
    </>
  );
  if (SCAN_URL) {
    return (
      <div className="card" id="key-card">
        <div className="card-head"><h2>Photo scanning</h2><span className="small muted">{key ? "Own key" : "On"}</span></div>
        <p className="small muted">Free during the beta, with a daily allowance per phone. Photos are shrunk on your phone, checked by Claude to find the food, and not kept by Pantry Prep.</p>
        <details open={!!key}>
          <summary className="small">Use your own Anthropic API key instead</summary>
          <p className="small muted">For unlimited scans. You pay Anthropic directly, roughly 4 to 6p per scan. The key stays on this device and is sent only to Anthropic.</p>
          {keyForm}
        </details>
        <p className="status" aria-live="polite">{status}</p>
      </div>
    );
  }
  return (
    <div className="card" id="key-card">
      <div className="card-head"><h2>Photo scanning</h2><span className="small muted">{key ? "On" : "Off"}</span></div>
      <p className="small muted">Scanning uses Claude through your own Anthropic API key, so you pay Anthropic directly, roughly 4 to 6p per scan. The key is kept only on this device and is sent only to Anthropic. Photos go to Anthropic for the scan and are not stored by Pantry Prep.</p>
      {keyForm}
      <p className="status" aria-live="polite">{status}</p>
    </div>
  );
}

export function Prepare() {
  const { state, update, replace, openSheet, toast } = useApp();
  const [dlStatus, setDlStatus] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const picked = pickedRecipes(state);

  return (
    <>
      <div className="card">
        <div className="card-head"><h2>Household</h2></div>
        <div>
          <HouseRow k="adults" label="Adults" sub="2,000 kcal a day each" />
          <HouseRow k="children" label="Children" sub="About 1,400 kcal a day each" />
          <HouseRow k="pets" label="Pets" sub="Store their food and water too" />
          <HouseRow k="days" label="Days to cover" sub="UK advice: at least 3" />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Allergies and diet</h2><button className="link-btn" id="diet-btn" onClick={() => openSheet({ kind: "diet" })}>Change</button></div>
        <p className="small muted">{allergySummary(state)}. Recipes that may not suit you are hidden. Kept on this phone only.</p>
      </div>

      <div className="card">
        <div className="card-head"><h2>Recipe cards to print</h2><span className="small muted num">{picked.length} picked</span></div>
        <p className="small muted">Four cards per A4 sheet, plus a dated stock list. Print it and keep it in a sleeve with your food.</p>
        {picked.length ? (
          <div className="rows">
            {picked.map((r) => (
              <div className="row-item" key={r.id}>
                <div className="dot" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>{r.serves}</div>
                <div className="row-main"><span className="t">{r.title}</span><span className="s">Serves {r.serves} · {r.cook ? "Camping stove" : "No cooking"}</span></div>
                <button className="link-btn" onClick={() => openSheet({ kind: "recipe", id: r.id })}>View</button>
              </div>
            ))}
          </div>
        ) : <p className="empty-line">No recipes picked yet.</p>}
        <button className="btn primary block" id="download-btn" disabled={!picked.length} onClick={async () => {
          setDlStatus("Preparing your cards…");
          setDlStatus(await openPrintable(buildPrintFile(state, new URL("./", location.href).href)));
        }}>Download cards to print</button>
        <button className="btn block" onClick={() => {
          const ids = sortedRecipes(state).filter((x) => x.s.ready).map((x) => x.r.id);
          update((s) => { s.picked = ids; });
          setDlStatus(ids.length ? `Picked ${plural(ids.length, "recipe", "recipes")} you can make now.` : "No recipe can be made from your store yet.");
        }}>Pick every recipe I can make now</button>
        <p className="status" aria-live="polite">{dlStatus}</p>
      </div>

      <KitCard />
      <KeyCard />

      <div className="card">
        <div className="card-head"><h2>Back up your store</h2></div>
        <p className="small muted">Your store is kept only on this device. Save a backup file now and then, so you can restore it on a new phone.</p>
        <button className="btn block" onClick={() => {
          const name = `pantry-prep-backup-${new Date().toISOString().slice(0, 10)}.json`;
          saveFile(name, toBackup(state), "application/json").then(() => setBackupStatus(`Backup saved as ${name}.`), () => setBackupStatus("The backup could not be saved here."));
        }}>Save a backup file</button>
        <label className="btn block file-btn" htmlFor="restore-input">Restore from a backup file
          <input type="file" id="restore-input" accept="application/json,.json" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const restored = fromBackup(await f.text());
            if (!restored) { setBackupStatus("That file is not a Pantry Prep backup."); return; }
            replace(restored); toast("Store restored from backup");
          }} />
        </label>
        <p className="status" aria-live="polite">{backupStatus}</p>
      </div>

      <div className="card">
        <div className="card-head"><h2>Official guidance</h2></div>
        <ul className="links">
          {LINKS.map(([url, title, note]) => <li key={url}><a href={url} target="_blank" rel="noopener">{title} ↗</a><span className="small muted">{note}</span></li>)}
        </ul>
        <p className="small muted">Links checked 26 November 2026.</p>
      </div>

      <div className="card">
        <div className="card-head"><h2>About Pantry Prep</h2></div>
        <div className="rows">
          {[["privacy", "Privacy", "Your store stays on this phone"], ["terms", "Terms and disclaimer", "General guidance, not medical advice"], ["accessibility", "Accessibility", "How we make the app usable for everyone"]].map(([id, t, s]) => (
            <a className="row-item row-link" href={`#${id}`} key={id}><div className="row-main"><span className="t">{t}</span><span className="s">{s}</span></div><span className="chev" aria-hidden="true">›</span></a>
          ))}
        </div>
      </div>
      <p className="small muted disclaimer">Pantry Prep gives general guidance, not medical or dietary advice. Check allergens on packs and follow official emergency advice first.</p>
    </>
  );
}
