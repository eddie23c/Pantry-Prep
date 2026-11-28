// The Add food sheet: photograph a pile of food (the main way), search the food list, or scan a barcode.
import { useEffect, useMemo, useRef, useState } from "react";
import { renderBarcodePane, stopBarcode } from "../barcode";
import { CAT, CATALOGUE, GROUP_ORDER, GROUPS, KINDS } from "../data";
import { getApiKey, getInviteCode, getTesterCode, MAX_PHOTOS, SCAN_URL, ScanError, scanCompare, scanHosted, scanWithApiKey, sendVote, setInviteCode, modelLabel, type CompareRun } from "../scan";
import { CompareResults } from "./Compare";
import { kitFrom, normalise, samplePrompt, type ScannedItem } from "../scanResult";
import { fromCat, uid } from "../storage";
import { isIsoDate, todayIso } from "../dates";
import { addItem, fmt, GroupDot, GSHORT, plural } from "./common";
import { Sheet } from "./Sheets";
import { useApp, type AddMode } from "./appState";
import "./scan.css";

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
    else s.items.push({ uid: uid(), cat: null, code: d.code, name: d.name, pack: d.pack, group: d.group, kind: d.kind, kcal: d.kcal, protein: d.protein, fibre: d.fibre, portions: d.portions, litres: d.litres, count: n, added: todayIso() });
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
  daily_limit: "That's all the photo scans for today on this phone. They reset at midnight. You can still search or scan barcodes.",
  busy: "Photo scanning is full for today. Try again tomorrow, or search or scan barcodes for now.",
  too_big: `Up to ${MAX_PHOTOS} photos per scan.`, bad_code: "That invite code is not right. Check it and try again.",
  code_needed: "Enter the invite code you were given to start scanning.",
  bad_tester: "Your tester code is not right. Check it on the Prepare tab.", compare_off: "Model comparison is not turned on in the scanner yet.",
};
const SAMPLE_ERRORS: Record<string, string> = {
  cancelled: "Stopped.", not_granted: "Photo scanning needs your permission to use Claude. You can still search foods.",
  rate_limited: "Too many scans just now. Try again in a few minutes.", image_rejected: "One photo could not be read. Use a JPEG or PNG under 20 MB.",
  invalid_json: "The scan came back in an unexpected format. Try again.", refused: "That photo could not be scanned. Try another.",
};

type Route = "hosted" | "key" | "sample";

function ScanPane({ onMissing }: { onMissing: () => void }) {
  const { state, update, closeSheet, go, toast } = useApp();
  const sample = useSampleAvailable();
  const hasKey = !!getApiKey();
  // Your own key wins if you saved one; otherwise the Pantry Prep scanner; otherwise Claude (inside a Claude artifact).
  const route: Route | null = hasKey ? "key" : SCAN_URL ? "hosted" : sample.ok ? "sample" : null;
  const canCompare = route === "hosted" && !!getTesterCode();
  const [compare, setCompare] = useState(false);
  const [compared, setCompared] = useState<CompareRun[] | null>(null);
  const max = compare ? 1 : route === "sample" ? sample.max : MAX_PHOTOS;
  const [files, setFiles] = useState<File[]>([]);
  const [scanned, setScanned] = useState<ScannedItem[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<AbortController | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  useEffect(() => () => busy?.abort(), [busy]);
  useEffect(() => { if (needCode) codeInput.current?.focus(); }, [needCode]);

  if (!route) {
    return (
      <div className="drop">{CAMERA_ICON}
        {sample.ok === null ? <b>Checking photo scanning…</b> : (
          <>
            <b>Turn on photo scanning</b>
            <span className="small muted">Photo scanning uses Claude. Add your own Anthropic API key once and it stays on this device.</span>
            <button className="btn primary" onClick={() => { closeSheet(); go("prepare"); setTimeout(() => { document.getElementById("key-card")?.scrollIntoView({ block: "start" }); document.getElementById("key-input")?.focus(); }, 50); }}>Add API key</button>
            <button className="btn" onClick={onMissing}>Search the food list instead</button>
          </>
        )}
      </div>
    );
  }

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list || []).filter((f) => f.type.startsWith("image/"));
    const all = [...files, ...picked];
    setFiles(all.slice(0, max)); setScanned(null);
    setMsg(all.length > max ? `Up to ${max} photos per scan. Using the first ${max}.` : "");
  };

  const run = async () => {
    const ctl = new AbortController();
    setBusy(ctl); setNeedCode(false); setMsg("Looking for every tin, packet and bottle. This usually takes 10 to 30 seconds.");
    try {
      if (compare) {
        const r = await scanCompare(files[0], ctl.signal);
        setLeft(null); setCompared(r.results);
        setMsg(`Compared ${plural(r.results.length, "model", "models")}${r.remaining !== null ? ` · ${plural(r.remaining, "compare", "compares")} left today` : ""}.`);
        return;
      }
      let data: unknown;
      if (route === "hosted") {
        const r = await scanHosted(files, ctl.signal);
        data = r.data; setLeft(r.remaining);
      } else if (route === "key") data = await scanWithApiKey(files, ctl.signal);
      else data = await sampleP.then((s) => { if (!s) throw { code: "not_granted" }; return s.json(samplePrompt(), { images: files, signal: ctl.signal }); });
      showResult(data);
    } catch (err: any) {
      const c = ctl.signal.aborted ? "cancelled" : err && err.code;
      if (err instanceof ScanError) {
        if (err.remaining !== null) setLeft(err.remaining);
        if (c === "code_needed" || c === "bad_code") setNeedCode(true);
        setMsg(KEY_ERRORS[c] || `The scan did not finish: ${err.message}`);
      } else setMsg(SAMPLE_ERRORS[c] || "The scan did not finish. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };
  function showResult(data: unknown) {
    const items = normalise(data);
    const seen = kitFrom(data).filter((k) => !state.kit[k.id]);
    if (seen.length) update((s) => { for (const k of seen) s.kit[k.id] = "photo"; });
    setScanned(items);
    const unsure = items.filter((i) => i.conf === "low").length;
    const kitMsg = seen.length ? ` Ticked off on your kit list: ${seen.map((k) => k.label.split(" (")[0]).join(", ")}.` : "";
    setMsg((items.length
      ? `Found ${plural(items.length, "product", "products")}${unsure ? `, ${unsure} to check` : ""}${items.some((i) => i.bb) ? `, and read ${plural(items.filter((i) => i.bb).length, "date", "dates")}` : ""}. Fix names, counts and dates, untick anything wrong, then add. Items with no date get an estimate you can change later.`
      : "No food found. Try a closer photo with labels facing the camera.") + kitMsg);
  }
  const pick = (model: string) => {
    sendVote(model).catch(() => {});
    const chosen = compared?.find((r) => r.model === model);
    setCompared(null);
    if (chosen) { showResult(chosen); toast(`Thanks. ${modelLabel(model)} noted as most accurate`); }
    else { setFiles([]); setMsg("Thanks, noted. Try another photo, or search the food list."); }
  };
  const list = scanned || [];
  const keep = list.filter((s) => s.keep).length;
  const edit = (i: number, fn: (s: ScannedItem) => void) => setScanned((all) => (all || []).map((s, n) => { if (n !== i) return s; const c = { ...s }; fn(c); return c; }));
  const addChosen = (again: boolean) => {
    const chosen = list.filter((s) => s.keep);
    const today = todayIso();
    update((st) => { for (const s of chosen) addItem(st, { uid: uid(), cat: s.cat, name: s.name, pack: s.pack, group: s.group, kind: s.kind, kcal: s.kcal, protein: s.protein, fibre: s.fibre, portions: s.portions, litres: s.litres, count: s.count, added: today, ...(s.bb ? { bb: s.bb } : {}) }); });
    const dated = chosen.filter((s) => s.bb).length;
    toast(`Added ${plural(chosen.length, "item", "items")} from your photos${dated ? `, ${dated} with dates` : ""}`);
    if (again) { setFiles([]); setScanned(null); setCompared(null); setMsg("Added. Photograph the next shelf or pile."); }
    else { closeSheet(); go("store"); }
  };

  return (
    <>
      {!scanned && !compared && (
        <div className="drop">{CAMERA_ICON}
          <b>Photograph a pile of food</b>
          <span className="small muted">Pile it on a table or open the cupboard, labels facing you, and take one photo per shelf or pile. Claude finds every item and you check the list. Torches, radios and first aid kits are ticked off your Be Ready list too.</span>
          <div className="scan-pick">
            <label className="file-label" htmlFor="photo-camera">{files.length ? "Add another photo" : "Take a photo"}
              <input type="file" id="photo-camera" accept="image/*" capture="environment" disabled={files.length >= max} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
            <label className="file-label alt" htmlFor="photo-input">Choose photos
              <input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp,image/heic" multiple disabled={files.length >= max} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          {files.length > 0 && (
            <div className="thumbs">{urls.map((u, i) => (
              <span className="thumb" key={u}>
                <img src={u} alt={`Photo ${i + 1} to scan`} />
                <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => { setFiles(files.filter((_, n) => n !== i)); setMsg(""); }}>×</button>
              </span>
            ))}</div>
          )}
          <span className="small muted">Up to {plural(max, "photo", "photos")} per scan{route === "hosted" && left !== null && !compare ? ` · ${plural(left, "photo scan", "photo scans")} left today` : ""}.</span>
          {canCompare && (
            <label className="compare-toggle small">
              <input type="checkbox" checked={compare} onChange={(e) => { setCompare(e.target.checked); if (e.target.checked && files.length > 1) setFiles(files.slice(0, 1)); }} />
              Compare models on this photo (tester)
            </label>
          )}
        </div>
      )}
      {needCode && (
        <form className="card scan-code" onSubmit={(e) => { e.preventDefault(); const v = codeInput.current?.value.trim() || ""; if (!v) return; setInviteCode(v); run(); }}>
          <label htmlFor="invite-code"><b>Invite code</b></label>
          <span className="small muted">Pantry Prep is in a friends beta. Type the code you were given. It is saved on this phone.</span>
          <input id="invite-code" ref={codeInput} type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} defaultValue={getInviteCode()} />
          <button className="btn primary block" type="submit" disabled={!!busy}>Save code and scan</button>
        </form>
      )}
      {files.length > 0 && !scanned && !compared && !needCode && (
        <>
          <button className="btn primary block" disabled={!!busy} onClick={run}>{busy ? "Looking at your photos…" : compare ? "Compare models on this photo" : `Find food in ${plural(files.length, "photo", "photos")}`}</button>
          {busy && <button className="btn block" onClick={() => busy.abort()}>Stop</button>}
        </>
      )}
      <p className="status" aria-live="polite">{msg}</p>
      {compared && <CompareResults results={compared} onPick={pick} />}
      {scanned && (
        <>
          {list.length > 0 && (
            <div className="card" style={{ padding: "6px 16px" }}>
              <div className="rows" aria-label="Food found in your photos">
                {list.map((s, i) => (
                  <div className={`scan-row${s.keep ? "" : " off"}`} key={i}>
                    <input type="checkbox" checked={s.keep} aria-label={`Keep ${s.name}`} onChange={(e) => edit(i, (x) => { x.keep = e.target.checked; })} />
                    <div className="row-main">
                      <input type="text" value={s.name} aria-label="Item name" onChange={(e) => edit(i, (x) => { x.name = e.target.value.slice(0, 80); })} />
                      <span className="s">{s.pack ? `${s.pack} · ` : ""}{GROUPS[s.group].label}{s.cat ? "" : " · estimate"} {s.conf === "low" ? <span className="conf low">check</span> : <span className={`conf ${s.conf}`}>{s.conf}</span>}</span>
                      <label className="scan-bb">
                        <span>Best before</span>
                        <input type="date" value={s.bb || ""} aria-label={`Best-before date for ${s.name}`} onChange={(e) => { const v = e.target.value; edit(i, (x) => { if (isIsoDate(v)) x.bb = v; else delete x.bb; }); }} />
                      </label>
                    </div>
                    <div className="stepper">
                      <button onClick={() => edit(i, (x) => { x.count = Math.max(1, x.count - 1); })} aria-label={`Fewer ${s.name}`}>−</button>
                      <span className="num" aria-label="Count">{s.count}</span>
                      <button onClick={() => edit(i, (x) => { x.count = Math.min(99, x.count + 1); })} aria-label={`More ${s.name}`}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {keep > 0 && <button className="btn primary block" onClick={() => addChosen(false)}>Add {plural(keep, "item", "items")} to store</button>}
          {keep > 0 && <button className="btn block" onClick={() => addChosen(true)}>Add and scan the next shelf</button>}
          {!keep && <button className="btn primary block" onClick={() => { setFiles([]); setScanned(null); setMsg(""); }}>Try other photos</button>}
          <button className="link-btn scan-missing" onClick={onMissing}>Something missing? Search the food list</button>
        </>
      )}
    </>
  );
}

// Photo first: one photo of a pile of food is the main way to add food. Search and barcodes are for odd items.
const MODES: [AddMode, string][] = [["scan", "Photo"], ["search", "Search"], ["barcode", "Barcode"]];

export function AddSheet({ group, mode: initial }: { group?: string; mode?: AddMode }) {
  const [mode, setMode] = useState<AddMode>(initial || "scan");
  return (
    <Sheet title="Add food" extra={
      <div className="seg" role="tablist" aria-label="How to add food">
        {MODES.map(([id, label]) => <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}>{label}</button>)}
      </div>
    }>
      {mode === "search" && <SearchPane initialGroup={group || "all"} />}
      {mode === "barcode" && <BarcodePane />}
      {mode === "scan" && <ScanPane onMissing={() => setMode("search")} />}
    </Sheet>
  );
}
