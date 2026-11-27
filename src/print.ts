// The printable A4 file: a cover page (stock list, kit checklist, household plan) and recipe
// cards, four to a sheet. Designed to read in a power cut: black on white, large type, no colour
// needed, and a QR code back to the app. Pure function of the state, tested in print.test.ts.
import qrcode from "qrcode-generator";
import { ALLERGENS, recipeAllergens } from "./allergens";
import { kitFor, kitState, people, targets, totals, type AppState } from "./calc";
import { KINDS, RECIPES, type Recipe } from "./data";
import { formatDate } from "./dates";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const ingLabel = (k: string[]) => k.map((x) => KINDS[x]).join(" or ");

/** A QR code as inline SVG (black modules, no colour). */
export function qrSvg(text: string, label: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true }).replace("<svg ", `<svg role="img" aria-label="${esc(label)}" `);
}

function card(r: Recipe): string {
  const allergens = recipeAllergens(r).map((a) => ALLERGENS[a].toLowerCase());
  const band = [r.cook ? "Camping stove" : "No cooking", `Serves ${r.serves}`, r.water ? `${r.water} L water` : ""].filter(Boolean);
  return `<div class="card"><div class="band">${band.map((b) => `<span>${esc(b)}</span>`).join("")}</div>
    <h3>${esc(r.title)}</h3>
    <b>You need</b><ul>${r.ings.map((i) => `<li>${esc(ingLabel(i.k))}: ${esc(i.q)}${i.opt ? " (optional)" : ""}</li>`).join("")}</ul>
    <b>Method</b><ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <p class="allergy">${allergens.length ? `May contain ${esc(allergens.join(", "))}. ` : ""}Check labels for allergens.</p></div>`;
}

export function buildPrintFile(state: AppState, appUrl: string, now: Date = new Date()): string {
  const picked = RECIPES.filter((r) => state.picked.includes(r.id));
  const t = totals(state.items), tg = targets(state.house), h = state.house;
  const today = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const sheets: Recipe[][] = [];
  for (let i = 0; i < picked.length; i += 4) sheets.push(picked.slice(i, i + 4));
  const items = [...state.items].sort((a, b) => (a.bb || "9999") < (b.bb || "9999") ? -1 : (a.bb || "9999") > (b.bb || "9999") ? 1 : a.name.localeCompare(b.name));
  const rows = items.map((it) => `<tr><td>${esc(it.name)}</td><td>${esc(it.pack || "")}</td><td class="n">${esc(it.count)}</td><td>${it.bb ? esc(formatDate(it.bb)) : ""}</td></tr>`).join("");
  const kit = kitFor(state).map((k) => `<li><span class="box">${kitState(k, state) ? "✓" : ""}</span>${esc(k.label)}</li>`).join("");
  const qr = qrSvg(appUrl, "QR code: open Pantry Prep");

  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Pantry Prep: emergency store and recipe cards</title><style>
@page{size:A4;margin:10mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;margin:0;font-size:12pt;line-height:1.35}
h1{font-size:22pt;margin:0 0 2mm}h2{font-size:14pt;margin:5mm 0 2mm;border-bottom:1.5pt solid #000;padding-bottom:1mm}h3{font-size:15pt;margin:0 0 2mm;line-height:1.15}
.page{width:190mm;min-height:277mm;break-after:page;page-break-after:always;position:relative}
.head{display:flex;justify-content:space-between;gap:6mm;align-items:flex-start}.head svg{width:26mm;height:26mm;flex:none}
.qrnote{font-size:9pt;text-align:center;width:26mm}
.sheet{width:190mm;height:277mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6mm;break-after:page;page-break-after:always}
.card{border:1.5pt dashed #000;padding:4mm 5mm;overflow:hidden;font-size:11pt}
.band{display:flex;flex-wrap:wrap;gap:2mm 4mm;border-bottom:1pt solid #000;margin:0 0 2.5mm;padding-bottom:1.5mm;font-weight:bold;font-size:9pt;text-transform:uppercase;letter-spacing:.04em}
ul,ol{margin:1mm 0 2.5mm;padding-left:5mm}li{margin-bottom:.8mm}
.allergy{font-size:9pt;margin:0;font-style:italic}
table{border-collapse:collapse;width:100%;font-size:11pt}th,td{border:1pt solid #000;padding:1.5mm 2mm;text-align:left;vertical-align:top}th{background:#fff}td.n{text-align:right;width:14mm}
.kit{columns:2;list-style:none;padding:0;margin:0;font-size:11pt}.kit li{break-inside:avoid;display:flex;gap:2mm;margin-bottom:1.5mm}
.box{display:inline-block;width:4.5mm;height:4.5mm;border:1pt solid #000;flex:none;text-align:center;line-height:4.2mm;font-size:10pt}
.plan td{height:9mm}.plan th{width:58mm}
.note{font-size:9.5pt}.keep{break-inside:avoid;page-break-inside:avoid}h2{break-after:avoid}
@media screen{body{padding:10mm;background:#ccc}.page,.sheet{background:#fff;margin:0 auto 10mm;padding:10mm;box-sizing:content-box}.tip{max-width:190mm;margin:0 auto 6mm;background:#fff;padding:4mm;border:2px solid #000;font-size:11pt}}
@media print{.tip{display:none}}
</style></head><body>
<div class="tip"><b>Print on A4</b> (File, then Print). Black and white is fine. Cut the recipe cards along the dashed lines and keep everything in a plastic sleeve with your food.</div>
<div class="page">
<div class="head"><div><h1>Our emergency store</h1>
<p>Checked on <b>${esc(today)}</b>. For ${plural(h.adults, "adult", "adults")}${h.children ? ` and ${plural(h.children, "child", "children")}` : ""}${h.pets ? `, plus ${plural(h.pets, "pet", "pets")}` : ""}, for ${plural(h.days, "day", "days")}.</p>
<p>Food: about <b>${fmt(t.kcal)}</b> of ${fmt(tg.kcal)} kcal needed. Water: <b>${fmt(t.water)} L</b> of ${fmt(tg.water)} L needed (3 L per person per day, for ${plural(people(h), "person", "people")}).</p></div>
<div><div>${qr}</div><div class="qrnote">Scan to open Pantry Prep</div></div></div>
<h2>Food and water${items.some((i) => i.bb) ? ", soonest date first" : ""}</h2>
${items.length ? `<table><thead><tr><th>Item</th><th>Pack</th><th>Count</th><th>Best before</th></tr></thead><tbody>${rows}</tbody></table>` : "<p>No items logged yet.</p>"}
<p class="note">Eat and replace items before their best-before date. Keep this list with the food and update it when you use something.</p>
<div class="keep"><h2>Be Ready kit</h2><ul class="kit">${kit}</ul></div>
<div class="keep"><h2>Our plan</h2>
<table class="plan"><tbody><tr><th>Emergency contacts</th><td></td></tr><tr><th>Where we meet if we can't go home</th><td></td></tr><tr><th>Water stopcock, fuse box and gas meter</th><td></td></tr><tr><th>Medicines and who needs them</th><td></td></tr></tbody></table>
<p class="note">UK Government advice: beready.campaign.gov.uk. In an emergency, follow instructions from the emergency services first. Pantry Prep gives general guidance, not medical or dietary advice.</p></div>
</div>
${sheets.map((pg) => `<div class="sheet">${pg.map(card).join("")}</div>`).join("")}
</body></html>`;
}
