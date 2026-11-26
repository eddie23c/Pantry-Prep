// Barcode scanning: the camera reads the barcode on the phone, then Open Food Facts
// (a free, open product database) is asked for the product's name and nutrition.
// Only the barcode number leaves the phone. Lookups are cached so repeat scans work offline.
import { GROUPS, GROUP_ORDER, KINDS, type GroupId } from "./data";
import { isBarcode, toDraft, validCheckDigit, type BarcodeDraft, type OffProduct } from "./off";

export interface BarcodeHost {
  /** Add `count` packs of the confirmed product to the store. */
  add(draft: BarcodeDraft, count: number): void;
  toast(msg: string): void;
}

type Phase = "idle" | "camera" | "looking" | "confirm";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const CACHE_KEY = "pantry-prep-barcodes";
const OFF_FIELDS = "product_name,product_name_en,brands,quantity,product_quantity,product_quantity_unit,categories_tags,nutriments";

let phase: Phase = "idle";
let draft: BarcodeDraft | null = null;
let count = 1;
let note = "";
let stream: MediaStream | null = null;
let timer = 0;
let lookupCtl: AbortController | null = null;
let root: HTMLElement | null = null;
let host: BarcodeHost | null = null;

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ---------- Detector: built into Chrome on Android; a bundled reader everywhere else (iPhone) ----------
interface Detector { detect(src: ImageBitmapSource): Promise<{ rawValue: string }[]> }
let detectorP: Promise<Detector> | null = null;

function getDetector(): Promise<Detector> {
  if (!detectorP) {
    detectorP = (async () => {
      const Native = (window as any).BarcodeDetector;
      if (Native) {
        try {
          const supported: string[] = await Native.getSupportedFormats();
          if (supported.includes("ean_13")) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) }) as Detector;
        } catch { /* fall through to the bundled reader */ }
      }
      const [{ BarcodeDetector, setZXingModuleOverrides }, wasm] = await Promise.all([
        import("barcode-detector/ponyfill"),
        import("zxing-wasm/reader/zxing_reader.wasm?url"),
      ]);
      // Load the reader from our own site (not a CDN), so it is cached and works offline.
      setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasm.default : prefix + path) });
      return new BarcodeDetector({ formats: FORMATS as any }) as unknown as Detector;
    })();
    detectorP.catch(() => { detectorP = null; });
  }
  return detectorP;
}

// ---------- Lookup cache ----------
function readCache(): Record<string, BarcodeDraft | null> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {}; } catch { return {}; }
}
function writeCache(code: string, d: BarcodeDraft | null) {
  try {
    const c = readCache();
    c[code] = d;
    const keys = Object.keys(c);
    for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete c[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch { /* storage full: lookups still work online */ }
}

function blank(code: string): BarcodeDraft {
  return { code, name: "", pack: "", group: "other", kind: null, kcal: 0, protein: 0, fibre: 0, portions: 0, litres: 0, guessedSize: true };
}

async function lookup(code: string) {
  stopCamera();
  phase = "looking"; note = ""; render();
  const cached = readCache()[code];
  if (cached !== undefined) {
    finish(cached ? { ...cached } : blank(code), cached ? "Found in your recent scans." : "This barcode is not in Open Food Facts yet. Fill in the details from the pack.");
    return;
  }
  lookupCtl?.abort();
  const ctl = (lookupCtl = new AbortController());
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`, { signal: ctl.signal });
    if (res.status === 404) { writeCache(code, null); finish(blank(code), "This barcode is not in Open Food Facts yet. Fill in the details from the pack."); return; }
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    if (body.status !== 1 || !body.product) { writeCache(code, null); finish(blank(code), "This barcode is not in Open Food Facts yet. Fill in the details from the pack."); return; }
    const d = toDraft(code, body.product as OffProduct);
    writeCache(code, d);
    finish(d, d.guessedSize ? "Found it, but the pack size is missing. Check the figures against the pack." : "Found on Open Food Facts. Check the details against the pack.");
  } catch {
    if (phase !== "looking" || ctl !== lookupCtl) return;
    finish(blank(code), navigator.onLine === false ? "You're offline, so we couldn't look this up. Fill in the details from the pack." : "The lookup didn't finish. Fill in the details from the pack, or try again.");
  } finally {
    clearTimeout(t);
  }
}

function finish(d: BarcodeDraft, msg: string) {
  draft = d; count = 1; note = msg; phase = "confirm"; render();
  const first = root?.querySelector<HTMLInputElement>(d.name ? "#bc-add" : "#bc-name");
  first?.focus({ preventScroll: true });
  root?.scrollTo?.(0, 0);
}

// ---------- Camera ----------
async function startCamera() {
  note = "";
  if (!navigator.mediaDevices?.getUserMedia) { note = "This browser can't open the camera here. Take a photo of the barcode or type the number instead."; render(); return; }
  try {
    const [detector, s] = await Promise.all([
      getDetector(),
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false }),
    ]);
    stream = s; phase = "camera"; render();
    const video = root?.querySelector<HTMLVideoElement>("#bc-video");
    if (!video) { stopCamera(); return; }
    video.srcObject = s;
    await video.play().catch(() => {});
    const tick = async () => {
      if (phase !== "camera" || !stream) return;
      try {
        if (video.readyState >= 2) {
          const hits = await detector.detect(video);
          const code = hits.map((h) => h.rawValue).find((v) => isBarcode(v) && validCheckDigit(v));
          if (code) { navigator.vibrate?.(40); lookup(code); return; }
        }
      } catch { /* a frame that fails to decode is normal */ }
      timer = window.setTimeout(tick, 200);
    };
    tick();
  } catch (e: any) {
    stopCamera();
    note = e?.name === "NotAllowedError" ? "Camera permission was turned off. Allow the camera in your browser settings, or take a photo of the barcode instead." : "The camera couldn't start. Take a photo of the barcode or type the number instead.";
    render();
  }
}

export function stopCamera() {
  clearTimeout(timer);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (phase === "camera") phase = "idle";
}

/** Call when the sheet closes or another tab is chosen. */
export function stopBarcode() {
  stopCamera();
  lookupCtl?.abort();
  if (phase === "looking") phase = "idle";
}

async function fromPhoto(file: File) {
  note = "Reading the barcode…"; render();
  try {
    const detector = await getDetector();
    const bmp = await createImageBitmap(file);
    const hits = await detector.detect(bmp);
    bmp.close?.();
    const code = hits.map((h) => h.rawValue).find((v) => isBarcode(v) && validCheckDigit(v));
    if (code) { lookup(code); return; }
    note = "No barcode found in that photo. Fill the frame with the barcode, keep it sharp, and try again.";
  } catch {
    note = "That photo couldn't be read. Try again, or type the number under the barcode.";
  }
  render();
}

// ---------- Rendering ----------
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/></svg>';

function groupOptions(sel: GroupId) {
  return GROUP_ORDER.map((g) => `<option value="${g}"${g === sel ? " selected" : ""}>${esc(GROUPS[g].label)}</option>`).join("");
}
function kindOptions(sel: string | null) {
  return '<option value="">Something else</option>' + Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(v)}</option>`).join("");
}

function render() {
  if (!root) return;
  const status = `<p class="status" aria-live="polite">${esc(note)}</p>`;
  if (phase === "camera") {
    root.innerHTML = `<div class="bc-cam"><video id="bc-video" playsinline muted aria-label="Camera view"></video><div class="bc-frame" aria-hidden="true"></div></div>
      <p class="small muted" style="text-align:center">Hold the barcode inside the frame. It scans by itself.</p>
      <button class="btn block" id="bc-stop">Stop camera</button>${status}`;
    return;
  }
  if (phase === "looking") {
    root.innerHTML = `<div class="drop">${ICON}<b>Looking up the product…</b><span class="small muted">Asking Open Food Facts.</span></div><button class="btn block" id="bc-cancel">Cancel</button>`;
    return;
  }
  if (phase === "confirm" && draft) {
    const d = draft, water = d.group === "water";
    root.innerHTML = `${status}<div class="card bc-form">
      <label class="field first" for="bc-name"><span class="t">Name</span><input id="bc-name" data-bc="name" type="text" maxlength="80" value="${esc(d.name)}" placeholder="For example, Baked beans"></label>
      <label class="field" for="bc-pack"><span class="t">Pack size</span><input id="bc-pack" data-bc="pack" type="text" maxlength="30" value="${esc(d.pack)}" placeholder="For example, 415 g tin"></label>
      <label class="field" for="bc-group"><span class="t">Food group</span><select id="bc-group" data-bc="group">${groupOptions(d.group)}</select></label>
      <label class="field" for="bc-kind"><span class="t">What kind of food</span><span class="s">Used to match recipes.</span><select id="bc-kind" data-bc="kind">${kindOptions(d.kind)}</select></label>
      ${water
        ? `<label class="field" for="bc-litres"><span class="t">Litres per pack</span><input id="bc-litres" data-bc="litres" type="number" inputmode="decimal" min="0" max="20" step="0.1" value="${d.litres}"></label>`
        : `<div class="bc-nums"><label class="field" for="bc-kcal"><span class="t">kcal per pack</span><input id="bc-kcal" data-bc="kcal" type="number" inputmode="numeric" min="0" max="10000" value="${d.kcal}"></label>
          <label class="field" for="bc-protein"><span class="t">Protein g</span><input id="bc-protein" data-bc="protein" type="number" inputmode="numeric" min="0" max="1000" value="${d.protein}"></label>
          <label class="field" for="bc-fibre"><span class="t">Fibre g</span><input id="bc-fibre" data-bc="fibre" type="number" inputmode="numeric" min="0" max="500" value="${d.fibre}"></label></div>`}
      <div class="set-row"><div class="row-main"><span class="t">How many packs</span><span class="s num">Barcode ${esc(d.code)}</span></div>
        <div class="stepper"><button data-bcstep="-1" aria-label="One fewer">−</button><span class="num" id="bc-count">${count}</span><button data-bcstep="1" aria-label="One more">+</button></div></div>
    </div>
    <button class="btn primary block" id="bc-add">Add ${count} to store</button>
    <button class="btn block" id="bc-again">Scan a different barcode</button>
    <p class="small muted">Product data from <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener">Open Food Facts</a>, shared under the Open Database Licence. Check the figures and allergens on the pack.</p>`;
    return;
  }
  root.innerHTML = `<div class="drop">${ICON}<b>Scan a barcode</b><span class="small muted">Point the camera at the barcode on a tin or packet. We look up the name and nutrition for you.</span>
      <button class="btn primary" id="bc-start">Start camera</button>
      <label class="file-label secondary" for="bc-photo">Take a photo of the barcode<input type="file" id="bc-photo" accept="image/*" capture="environment"></label></div>
    <form class="card bc-type" id="bc-type-form"><label class="field first" for="bc-code"><span class="t">Or type the number under the barcode</span>
      <input id="bc-code" type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]*" maxlength="14" placeholder="For example, 5000157024886"></label>
      <button class="btn block" type="submit">Look it up</button></form>${status}`;
}

function onClick(e: Event) {
  const el = (e.target as HTMLElement).closest("button");
  if (!el || !root?.contains(el)) return;
  if (el.id === "bc-start") startCamera();
  else if (el.id === "bc-stop") { stopCamera(); render(); }
  else if (el.id === "bc-cancel") { stopBarcode(); phase = "idle"; render(); }
  else if (el.id === "bc-again") { draft = null; note = ""; phase = "idle"; render(); }
  else if (el.dataset.bcstep) {
    count = Math.max(1, Math.min(99, count + Number(el.dataset.bcstep)));
    const c = root.querySelector("#bc-count"), a = root.querySelector("#bc-add");
    if (c) c.textContent = String(count);
    if (a) a.textContent = `Add ${count} to store`;
  } else if (el.id === "bc-add" && draft && host) {
    if (!draft.name.trim()) { note = "Give the product a name first."; render(); root.querySelector<HTMLInputElement>("#bc-name")?.focus(); return; }
    writeCache(draft.code, draft);
    host.add({ ...draft, name: draft.name.trim() }, count);
    host.toast(`Added ${count} × ${draft.name.trim()}`);
    draft = null; phase = "idle"; note = "Added. Scan the next item when you're ready."; render();
    root.querySelector<HTMLButtonElement>("#bc-start")?.focus();
  }
}

function onInput(e: Event) {
  const t = e.target as HTMLInputElement | HTMLSelectElement;
  const f = t.dataset.bc;
  if (!f || !draft) return;
  const d = draft as any;
  if (f === "name" || f === "pack") d[f] = t.value;
  else if (f === "kind") d.kind = t.value || null;
  else if (f === "group") {
    d.group = t.value as GroupId;
    if (e.type === "change") { render(); root?.querySelector<HTMLSelectElement>("#bc-group")?.focus(); }
  } else {
    const v = Number(t.value);
    d[f] = Number.isFinite(v) && v >= 0 ? v : 0;
  }
}

function onChange(e: Event) {
  const t = e.target as HTMLInputElement;
  if (t.id === "bc-photo" && t.files?.[0]) fromPhoto(t.files[0]);
  else onInput(e);
}

function onSubmit(e: Event) {
  if ((e.target as HTMLElement).id !== "bc-type-form") return;
  e.preventDefault();
  const code = (root?.querySelector<HTMLInputElement>("#bc-code")?.value || "").replace(/\s/g, "");
  if (!isBarcode(code)) { note = "A barcode number has 8 to 14 digits."; render(); return; }
  if (!validCheckDigit(code)) { note = "That number doesn't look right. Check the digits and try again."; render(); root?.querySelector<HTMLInputElement>("#bc-code")?.focus(); return; }
  lookup(code);
}

/** Draws the barcode pane into `el` (the sheet body). Safe to call again. */
export function renderBarcodePane(el: HTMLElement, h: BarcodeHost) {
  host = h;
  if (root !== el) {
    root = el;
    // The sheet body is reused by other panes, so listen only while it shows this one.
    el.addEventListener("click", (e) => { if (el.dataset.pane === "barcode") onClick(e); });
    el.addEventListener("input", (e) => { if (el.dataset.pane === "barcode") onInput(e); });
    el.addEventListener("change", (e) => { if (el.dataset.pane === "barcode") onChange(e); });
    el.addEventListener("submit", (e) => { if (el.dataset.pane === "barcode") onSubmit(e); });
  }
  el.dataset.pane = "barcode";
  if (phase === "camera" && !stream) phase = "idle";
  render();
}
