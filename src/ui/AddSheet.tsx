// The Add food sheet: search the food list, scan a barcode, or scan a photo with Claude.
import { useEffect, useMemo, useRef, useState } from "react";
import { renderBarcodePane, stopBarcode } from "../barcode";
import { CAT, CATALOGUE, GROUP_ORDER, GROUPS, KINDS } from "../data";
import { MAX_PHOTOS, ScanError, scanWithApiKey, getApiKey } from "../scan";
import { kitFrom, normalise, samplePrompt, type ScannedItem } from "../scanResult";
import { fromCat, uid } from "../storage";
import { addItem, fmt, GroupDot, GSHORT, plural } from "./common";
import { Sheet } from "./Sheets";
import { useApp, type AddMode } from "./appState";

const CAMERA_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></svg>
);

function SearchPane({ initialGroup }: { initialGroup: string }) {
  const { state, update, toast } = useApp();
  const [group, setGroup] = useState(initialGroup);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const res = CATALOGUE.filter((c) => (group === "all" || c.group === group) && (!q || `${c.name} ${c.pack} ${KINDS[c.kind]}`.toLowerCase().includes(q)));
  const counts: Record<string, number> = {};
  for (const it of state.items) if (it.cat) counts[it.cat] = (counts[it.cat] || 0) + it.count;
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <label className="search" htmlFor="food-q">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>
        <input id="food-q" ref={input} type="text" placeholder="Search tins, packets, water…" autoComplete="off" aria-label="Search foods" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="chips">
        {[["all", "All"], ...GROUP_ORDER.map((g) => [g, GROUPS[g].label])].map(([id, label]) => (
          <button key={id} className="chip" aria-pressed={group === id} onClick={() => { setGroup(id); input.current?.focus(); }}>{label}</button>
        ))}
      </div>
      <div className="card" style={{ padding: "4px 16px" }}>
        <div className="rows" id="food-results">
          {res.length ? res.map((c) => (
            <div className="row-item" key={c.id}>
              <GroupDot group={c.group}>{GSHORT[c.group]}</GroupDot>
              <div className="row-main"><span className="t">{c.name}</span><span className="s num">{c.pack} · {c.group === "water" ? `${c.litres} L` : `${fmt(c.kcal)} kcal`}{counts[c.id] ? ` · ${counts[c.id]} in store` : ""}</span></div>
              <button className="add-round" aria-label={`Add one ${c.name}`} onClick={() => { update((s) => addItem(s, fromCat(c.id, 1))); toast(`Added ${CAT[c.id].name}`); }}>+</button>
            </div>
          )) : <p className="empty-line">No match. Try another word, or scan a barcode or photo instead.</p>}
        </div>
      </div>
    </>
  );
}

function BarcodePane() {
  const { update, toast } = useApp();
  const el = useRef<HTMLDivElement>(null);
  // The barcode pane draws itself (barcode.ts); React only gives it a box and the add action.
  const host = useRef({ add: (_d: any, _n: number) => {}, toast: (_m: string) => {} });
  host.current.toast = toast;
  host.current.add = (d, n) => update((s) => {
    const ex = s.items.find((x) => x.code === d.code && !x.bb);
    if (ex) ex.count += n;
    else s.items.push({ uid: uid(), cat: null, code: d.code, name: d.name, pack: d.pack, group: d.group, kind: d.kind, kcal: d.kcal, protein: d.protein, fibre: d.fibre, portions: d.portions, litres: d.litres, count: n });
  });
  useEffect(() => {
    const node = el.current!;
    renderBarcodePane(node, { add: (d, n) => host.current.add(d, n), toast: (m) => host.current.toast(m) });
    return () => stopBarcode();
  }, []);
  return <div ref={el} className="pane" />;
}

// ---------- Photo scan ----------
type Sample = { json(prompt: string, o: { images: File[]; signal: AbortSignal }): Promise<unknown>; limits(): Promise<any> };
const w = window as any;
const sampleP: Promise<Sample | null> = w.claude?.use ? w.claude.use("sample").catch(() => null) : Promise.resolve(null);

function useSampleAvailable() {
  const [avail, setAvail] = useState<{ ok: boolean | null; max: number }>({ ok: null, max: MAX_PHOTOS });
  useEffect(() => {
    let live = true;
    sampleP.then(async (s) => {
      if (!s) { if (live) setAvail({ ok: false, max: MAX_PHOTOS }); return; }
      try {
        const l = await s.limits();
        if (live) setAvail({ ok: !!(l && l.images), max: Math.min(MAX_PHOTOS, (l && l.images && l.images.maxCount) || MAX_PHOTOS) });
      } catch { if (live) setAvail({ ok: false, max: MAX_PHOTOS }); }
    });
    return () => { live = false; };
  }, []);
  return avail;
}

const KEY_ERRORS: Record<string, string> = {
  no_key: "Add your API key on the Prepare tab first.", bad_key: "Your API key was not accepted. Check it on the Prepare tab.",
  rate_limited: "Too many scans just now. Try again in a minute.", refused: "Claude could not scan these photos. Try different ones.",
  network: "No connection. Photo scanning needs the internet, but you can still add food by hand.",
};
const SAMPLE_ERRORS: Record<string, string> = {
  cancelled: "Stopped.", not_granted: "Photo scanning needs your permission to use Claude. You can still search foods.",
  rate_limited: "Too many scans just now. Try again in a few minutes.", image_rejected: "One photo could not be read. Use a JPEG or PNG under 20 MB.",
  invalid_json: "The scan came back in an unexpected format. Try again.", refused: "That photo could not be scanned. Try another.",
};

function ScanPane() {
  const { state, update, closeSheet, go, toast } = useApp();
  const sample = useSampleAvailable();
  const hasKey = !!getApiKey();
  const max = hasKey ? MAX_PHOTOS : sample.max;
  const [files, setFiles] = useState<File[]>([]);
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<AbortController | null>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  useEffect(() => () => busy?.abort(), [busy]);

  if (!hasKey && sample.ok !== true) {
    return (
      <div className="drop">{CAMERA_ICON}
        {sample.ok === null ? <b>Checking photo scanning…</b> : (
          <>
            <b>Turn on photo scanning</b>
            <span className="small muted">Photo scanning uses Claude. Add your own Anthropic API key once and it stays on this device.</span>
            <button className="btn primary" onClick={() => { closeSheet(); go("prepare"); setTimeout(() => { document.getElementById("key-card")?.scrollIntoView({ block: "start" }); document.getElementById("key-input")?.focus(); }, 50); }}>Add API key</button>
          </>
        )}
      </div>
    );
  }

  const run = async () => {
    const ctl = new AbortController();
    setBusy(ctl); setMsg("This can take up to a minute.");
    try {
      const data = hasKey ? await scanWithApiKey(files, ctl.signal) : await sampleP.then((s) => { if (!s) throw { code: "not_granted" }; return s.json(samplePrompt(), { images: files, signal: ctl.signal }); });
      const items = normalise(data);
      const seen = kitFrom(data).filter((k) => !state.kit[k.id]);
      if (seen.length) update((s) => { for (const k of seen) s.kit[k.id] = "photo"; });
      setScanned(items);
      const kitMsg = seen.length ? ` Ticked off on your kit list: ${seen.map((k) => k.label.split(" (")[0]).join(", ")}.` : "";
      setMsg((items.length ? `Found ${plural(items.length, "food product", "food products")}. Untick or fix anything wrong, then add.` : "No food found in these photos.") + kitMsg);
    } catch (err: any) {
      const c = ctl.signal.aborted ? "cancelled" : err && err.code;
      if (err instanceof ScanError) setMsg(KEY_ERRORS[c] || `The scan did not finish: ${err.message}`);
      else setMsg(SAMPLE_ERRORS[c] || "The scan did not finish. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };
  const keep = scanned.filter((s) => s.keep).length;
  const edit = (i: number, fn: (s: ScannedItem) => void) => setScanned((list) => list.map((s, n) => { if (n !== i) return s; const c = { ...s }; fn(c); return c; }));

  return (
    <>
      <div className="drop">{CAMERA_ICON}
        <b>Photograph your shelves and kit</b>
        <span className="small muted">Spread tins out with labels facing the camera. Torches, radios, batteries and first aid kits are ticked off your Be Ready list too. Up to {max} photos at a time.</span>
        <label className="file-label" htmlFor="photo-input">{files.length ? "Choose different photos" : "Take or choose photos"}
          <input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => {
            const all = Array.from(e.target.files || []);
            setFiles(all.slice(0, max)); setScanned([]);
            setMsg(all.length > max ? `Using the first ${max} photos.` : "");
          }} />
        </label>
        <div className="thumbs">{urls.map((u) => <img key={u} src={u} alt="Photo to scan" />)}</div>
      </div>
      {files.length > 0 && !scanned.length && (
        <>
          <button className="btn primary block" disabled={!!busy} onClick={run}>{busy ? "Looking at your photos…" : `Find food in ${plural(files.length, "photo", "photos")}`}</button>
          {busy && <button className="btn block" onClick={() => busy.abort()}>Stop</button>}
        </>
      )}
      <p className="status" aria-live="polite">{msg}</p>
      {scanned.length > 0 && (
        <>
          <div className="card" style={{ padding: "6px 16px" }}>
            <div className="rows">
              {scanned.map((s, i) => (
                <div className="scan-row" key={i}>
                  <input type="checkbox" checked={s.keep} aria-label="Keep this item" onChange={(e) => edit(i, (x) => { x.keep = e.target.checked; })} />
                  <div className="row-main">
                    <input type="text" value={s.name} aria-label="Item name" onChange={(e) => edit(i, (x) => { x.name = e.target.value.slice(0, 80); })} />
                    <span className="s">{GROUPS[s.group].label}{s.cat ? "" : " · estimate"} <span className={`conf ${s.conf}`}>{s.conf}</span></span>
                  </div>
                  <div className="stepper">
                    <button onClick={() => edit(i, (x) => { x.count = Math.max(1, x.count - 1); })} aria-label="Fewer">−</button>
                    <span className="num">{s.count}</span>
                    <button onClick={() => edit(i, (x) => { x.count = Math.min(99, x.count + 1); })} aria-label="More">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button className="btn primary block" onClick={() => {
            const chosen = scanned.filter((s) => s.keep);
            update((st) => { for (const s of chosen) addItem(st, { uid: uid(), cat: s.cat, name: s.name, pack: s.pack, group: s.group, kind: s.kind, kcal: s.kcal, protein: s.protein, fibre: s.fibre, portions: s.portions, litres: s.litres, count: s.count }); });
            closeSheet(); go("store"); toast(`Added ${plural(chosen.length, "item", "items")} from your photos`);
          }}>Add {plural(keep, "item", "items")} to store</button>
        </>
      )}
    </>
  );
}

const MODES: [AddMode, string][] = [["search", "Search foods"], ["barcode", "Barcode"], ["scan", "Scan a photo"]];

export function AddSheet({ group, mode: initial }: { group?: string; mode?: AddMode }) {
  const [mode, setMode] = useState<AddMode>(initial || "search");
  return (
    <Sheet title="Add food" extra={
      <div className="seg" role="tablist" aria-label="How to add food">
        {MODES.map(([id, label]) => <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}>{label}</button>)}
      </div>
    }>
      {mode === "search" && <SearchPane initialGroup={group || "all"} />}
      {mode === "barcode" && <BarcodePane />}
      {mode === "scan" && <ScanPane />}
    </Sheet>
  );
}
