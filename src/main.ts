// @ts-nocheck
// Screens and interactions, ported from the prototype. Calculations live in calc.ts
// (typed and tested); this UI layer will be rebuilt in the chosen framework later.
import "./styles.css";
import * as C from "./calc";
import { CAT, CATALOGUE, GROUPS, GROUP_ORDER, KINDS, KIT, LINKS, RECIPES } from "./data";
import { defaultState, fromBackup, fromCat, load, save as saveState, toBackup, uid } from "./storage";
import { renderBarcodePane, stopBarcode } from "./barcode";
import { ALLERGENS, recipeAllergens, unsuitable } from "./allergens";
import { allergyPickerHTML, allergySummary, applyPickerClick, showOnboarding } from "./onboarding";
import { expiring, expiryPhrase, expiryStatus, formatDate, isIsoDate, kitCheckDue, todayIso } from "./dates";

// ---------- Colours and labels per group ----------
var GCOL = { water: "var(--water)", fruitveg: "var(--fibre)", starchy: "var(--warn)", protein: "var(--protein)", dairy: "var(--water)", oils: "var(--energy)", other: "var(--muted)" };
var GSHORT = { water: "H₂O", fruitveg: "FV", starchy: "SC", protein: "PR", dairy: "DA", oils: "OI", other: "EX" };

function addItem(item) {
  var ex = item.cat && state.items.find(function (x) { return x.cat === item.cat && x.name === item.name && (x.bb || "") === (item.bb || ""); });
  if (ex) ex.count += item.count; else state.items.push(item);
}

// ---------- Helpers ----------
function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function $(id) { return document.getElementById(id); }
function fmt(n) { return Math.round(n).toLocaleString("en-GB"); }
function num(v, lo, hi, d) { var n = Number(v); if (!isFinite(n)) n = d; return Math.min(hi, Math.max(lo, n)); }
function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
var state = load() || defaultState();
var ui = { screen: "home", filter: "all", showUnsuitable: false };
function save() { saveState(state); }
function people() { return C.people(state.house); }
function targets() { return C.targets(state.house); }
function totals() { return C.totals(state.items); }
function kindsHeld() { return C.kindsHeld(state.items); }
var level = C.level;
function shoppingList() { return C.shoppingList(state); }
function recipeStatus(r) { return C.recipeStatus(r, state.items); }
function whyNot(r) { return unsuitable(r, state.allergies, state.diet); }
function sortedRecipes(all) { return C.sortedRecipes(state.items).filter(function (x) { return all || !whyNot(x.r); }); }
function kitState(k) { return C.kitState(k, state); }
function ingLabel(i) { return i.k.map(function (k) { return KINDS[k]; }).join(" or "); }
var LEVEL_WORD = { ok: "On track", warn: "Nearly there", bad: "Short" };

function ring(pct, color, size, stroke) {
  var r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return '<svg viewBox="0 0 ' + size + " " + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + stroke + '"/>' +
    '<circle class="ring-fg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - p)).toFixed(1) + '"/></svg>';
}

function matchBadge(s) {
  var l = s.ready ? "ok" : s.have / s.req >= 0.5 ? "warn" : "bad";
  return '<span class="match st-' + l + '">' + (s.ready ? "✓ Ready" : s.have + " of " + s.req) + "</span>";
}
function recipeCard(x) {
  var r = x.r, s = x.s, on = state.picked.indexOf(r.id) >= 0;
  var chips = r.ings.filter(function (i) { return !i.opt; }).map(function (i) {
    var got = i.k.some(function (k) { return s.held[k]; });
    return '<span class="ing ' + (got ? "have" : "miss") + '">' + esc(ingLabel(i)) + "</span>";
  }).join("");
  return '<button class="rcard" data-recipe="' + r.id + '"><div class="rcard-top"><h3>' + esc(r.title) + "</h3>" + matchBadge(s) + "</div>" +
    '<div class="meta"><span>Serves ' + r.serves + "</span><span>" + (r.cook ? "Camping stove" : "No cooking") + "</span>" + (on ? '<span class="on-list">On print list</span>' : "") + "</div>" +
    '<div class="ings">' + chips + "</div>" + (whyNot(r) ? '<p class="small warn-text">' + esc(whyNot(r)) + "</p>" : "") + "</button>";
}

// ---------- Screens ----------
function renderTop() {
  var h = state.house;
  $("house-label").textContent = plural(people(), "person", "people") + " · " + plural(h.days, "day", "days");
  var titles = { home: "Your store", store: "Food store", recipes: "Recipes", prepare: "Be prepared" };
  $("top-title").textContent = titles[ui.screen];
  $("top-sub").textContent = ui.screen === "home" ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "Pantry Prep";
}

function renderHome() {
  var t = totals(), tg = targets(), h = state.house;
  var perDay = tg.kcal / h.days, foodDays = perDay ? t.kcal / perDay : 0, waterDays = people() ? t.water / (people() * 3) : 0;
  var days = Math.min(foodDays, waterDays), pct = days / h.days, lv = level(pct);
  var ringCol = lv === "ok" ? "var(--fibre)" : lv === "warn" ? "var(--warn)" : "var(--bad)";
  var limiter = waterDays < foodDays ? "water" : "food";
  var togo = Math.max(0, tg.kcal - t.kcal);
  var html = "";
  if (state.example) html += '<div class="banner"><b>You are looking at an example store.</b><span class="small">Clear it from the Store tab, then add your own food with the + button.</span></div>';
  html += '<div class="card hero"><div class="card-head" style="width:100%"><h2>Days covered</h2><span class="status-chip st-' + lv + '">' + LEVEL_WORD[lv] + "</span></div>" +
    '<div class="ring-wrap">' + ring(pct, ringCol, 190, 16) + '<div class="ring-center"><span class="big num">' + days.toFixed(1) + '</span><span class="lbl">of ' + plural(h.days, "day", "days") + "</span></div></div>" +
    '<p class="small muted">' + (pct >= 1 ? "Food and water both last the full " + plural(h.days, "day", "days") + "." : "Your " + limiter + " runs out first. Food lasts " + foodDays.toFixed(1) + " days, water " + waterDays.toFixed(1) + " days.") + "</p>" +
    '<div class="equation num"><div class="t"><span class="v">' + fmt(tg.kcal) + '</span><span class="k">Needed kcal</span></div><span class="op">−</span>' +
    '<div class="t"><span class="v">' + fmt(t.kcal) + '</span><span class="k">In store</span></div><span class="op">=</span>' +
    '<div class="t"><span class="v" style="color:' + (togo ? "var(--energy)" : "var(--fibre)") + '">' + fmt(togo) + '</span><span class="k">To go</span></div></div></div>';

  var minis = [
    { n: "Water", have: t.water, need: tg.water, u: "L", c: "var(--water)" },
    { n: "Protein", have: t.protein, need: tg.protein, u: "g", c: "var(--protein)" },
    { n: "Fibre", have: t.fibre, need: tg.fibre, u: "g", c: "var(--fibre)" }
  ];
  html += '<div class="card"><div class="card-head"><h2>Essentials</h2><button class="link-btn" data-sheet="about">How we count</button></div><div class="minis">' +
    minis.map(function (m) {
      var p = m.need ? m.have / m.need : 1;
      return '<div class="mini"><div class="ring-wrap">' + ring(p, m.c, 84, 9) + '<div class="ring-center"><span class="big num">' + Math.min(999, Math.round(p * 100)) + '%</span></div></div>' +
        '<span class="name">' + m.n + '</span><span class="of num">' + fmt(m.have) + " / " + fmt(m.need) + " " + m.u + "</span></div>";
    }).join("") + "</div></div>";

  html += '<div class="card"><div class="card-head"><h2>Balanced plate</h2><span class="small muted">Eatwell groups</span></div><div class="bars">' +
    ["fruitveg", "starchy", "protein", "dairy"].map(function (g) {
      var need = GROUPS[g].perDay * people() * h.days, have = t.groups[g], p = need ? have / need : 1;
      return '<div class="bar-row"><div class="bar-top"><b>' + esc(GROUPS[g].label) + '</b><span class="num muted">' + fmt(have) + " / " + fmt(need) + ' portions</span></div><div class="bar"><i style="width:' + Math.min(100, p * 100).toFixed(1) + "%;background:" + GCOL[g] + '"></i></div></div>';
    }).join("") + "</div></div>";

  html += useSoonCard();
  var shop = shoppingList();
  html += '<div class="card"><div class="card-head"><h2>Top up</h2><span class="small muted">' + (shop.length ? "Tap + when bought" : "") + '</span></div><div class="rows">' +
    (shop.length ? shop.map(function (s) {
      var c = CAT[s.id];
      return '<div class="row-item"><div class="dot num" style="background:color-mix(in srgb,' + GCOL[c.group] + ' 16%,transparent);color:' + GCOL[c.group] + '">' + s.n + '×</div>' +
        '<div class="row-main"><span class="t">' + esc(c.name) + '</span><span class="s">' + esc(c.pack) + " · " + esc(s.why) + '</span></div>' +
        '<button class="add-round" data-buy="' + s.id + '" data-n="' + s.n + '" aria-label="Mark ' + esc(c.name) + ' as bought">+</button></div>';
    }).join("") : '<p class="empty-line">Nothing essential to buy. Your store covers every target.</p>') + "</div></div>";

  var kitDone = KIT.filter(function (k) { return kitState(k); }).length;
  html += '<div class="card"><div class="card-head"><h2>Emergency kit</h2><button class="link-btn" data-go="prepare">Open checklist</button></div>' +
    '<div class="bar-row"><div class="bar-top"><b>' + kitDone + " of " + KIT.length + ' Be Ready items</b><span class="muted small">' + (kitCheckDue(state.kitChecked, todayIso()) ? (state.kitChecked ? "Due a check" : "Not checked yet") : kitDone === KIT.length ? "Complete" : "Checked " + formatDate(state.kitChecked)) + '</span></div><div class="bar"><i style="width:' + (kitDone / KIT.length * 100).toFixed(1) + '%;background:var(--brand)"></i></div></div></div>';
  var ready = sortedRecipes().filter(function (x) { return x.s.ready; });
  html += '<div class="card"><div class="card-head"><h2>Cook from your store</h2><button class="link-btn" data-go="recipes">See all</button></div>' +
    (ready.length ? '<div class="carousel">' + ready.map(recipeCard).join("") + "</div>" : '<p class="empty-line">Add a few more basics and recipes will appear here.</p>') + "</div>";
  html += '<p class="small muted disclaimer">General guidance, not medical advice. <button class="link-btn" data-sheet="about">How we count</button></p>';
  $("screen-home").innerHTML = html;
}

function renderStore() {
  var t = totals(), html = "";
  if (state.example) html += '<div class="banner" id="clear-box"><b>This is an example store.</b><span class="small">Clear it to start logging your own food.</span><div class="acts"><button class="btn" data-clear="ask">Clear example</button></div></div>';
  html += '<div class="card"><div class="summary-strip num"><div><span class="v">' + fmt(t.packs) + '</span><span class="k">Packs</span></div><div><span class="v">' + fmt(t.kcal) + '</span><span class="k">kcal</span></div><div><span class="v">' + fmt(t.water) + ' L</span><span class="k">Water</span></div></div></div>';
  var by = {};
  state.items.forEach(function (it) { (by[it.group] = by[it.group] || []).push(it); });
  GROUP_ORDER.forEach(function (g) {
    var list = by[g] || [];
    if (!list.length && (g === "oils" || g === "other")) return;
    var sub = g === "water" ? fmt(list.reduce(function (a, it) { return a + it.litres * it.count; }, 0)) + " L" : fmt(list.reduce(function (a, it) { return a + it.kcal * it.count; }, 0)) + " kcal";
    html += '<div class="card section-card"><div class="section-head"><h3><span class="swatch" style="background:' + GCOL[g] + '"></span>' + esc(GROUPS[g].label) + '</h3><span class="small muted num">' + sub + '</span></div><div class="section-body rows">';
    if (!list.length) html += '<p class="empty-line">Nothing here yet.</p>';
    list.forEach(function (it) {
      var right = g === "water" ? fmt(it.litres * it.count) + " L" : fmt(it.kcal * it.count) + " kcal";
      html += '<div class="row-item" data-uid="' + esc(it.uid) + '"><div class="dot" style="background:color-mix(in srgb,' + GCOL[g] + ' 15%,transparent);color:' + GCOL[g] + '">' + GSHORT[g] + '</div>' +
        '<button class="row-main row-btn" data-item="' + esc(it.uid) + '" aria-label="' + esc(it.name) + ', details and best-before date"><span class="t">' + esc(it.name) + (it.cat || it.code ? "" : '<span class="tag">estimate</span>') + bbTag(it) + '</span><span class="s num">' + esc(it.pack || "") + (it.pack ? " · " : "") + right + '</span></button>' +
        '<div class="stepper"><button data-step="-1" aria-label="One fewer ' + esc(it.name) + '">−</button><span class="num">' + esc(it.count) + '</span><button data-step="1" aria-label="One more ' + esc(it.name) + '">+</button></div></div>';
    });
    html += '</div><div class="section-foot"><button class="link-btn" data-addgroup="' + g + '">+ Add ' + esc(GROUPS[g].label.toLowerCase()) + "</button></div></div>";
  });
  $("screen-store").innerHTML = html;
}

function renderRecipes() {
  var list = sortedRecipes(ui.showUnsuitable), ready = list.filter(function (x) { return x.s.ready; }).length, f = ui.filter;
  var hidden = sortedRecipes(true).length - sortedRecipes(false).length;
  var shown = list.filter(function (x) { return f === "all" || (f === "ready" && x.s.ready) || (f === "nocook" && !x.r.cook) || (f === "picked" && state.picked.indexOf(x.r.id) >= 0); });
  $("screen-recipes").innerHTML =
    '<p class="muted small">You can make <b style="color:var(--ink)">' + ready + " of " + list.length + "</b> recipes with what is in your store. Tap one to see the method or add it to your print cards.</p>" +
    (hidden ? '<p class="small muted">' + (ui.showUnsuitable ? "Showing every recipe, including " + plural(hidden, "one", "ones") + " that may not suit your allergies or diet. " : plural(hidden, "recipe is", "recipes are") + " hidden because of your allergies or diet. ") +
      '<button class="link-btn" id="toggle-unsuitable">' + (ui.showUnsuitable ? "Hide them" : "Show them") + "</button></p>" : "") +
    '<div class="chips" role="group" aria-label="Filter recipes">' +
    [["all", "All"], ["ready", "Can make now"], ["nocook", "No cooking"], ["picked", "Print list"]].map(function (c) { return '<button class="chip" data-filter="' + c[0] + '" aria-pressed="' + (f === c[0]) + '">' + c[1] + "</button>"; }).join("") + "</div>" +
    '<div class="recipe-list">' + (shown.map(recipeCard).join("") || '<p class="muted">No recipes match this filter yet.</p>') + "</div>";
}

function stepperRow(key, label, sub, val) {
  return '<div class="set-row"><div class="row-main"><span class="t">' + label + '</span><span class="s">' + sub + '</span></div><div class="stepper"><button data-house="' + key + '" data-d="-1" aria-label="Fewer ' + label + '">−</button><span class="num">' + val + '</span><button data-house="' + key + '" data-d="1" aria-label="More ' + label + '">+</button></div></div>';
}
function renderPrepare() {
  var h = state.house, picked = pickedRecipes(), done = KIT.filter(function (k) { return kitState(k); }).length;
  var html = '<div class="card"><div class="card-head"><h2>Household</h2></div><div>' +
    stepperRow("adults", "Adults", "2,000 kcal a day each", h.adults) +
    stepperRow("children", "Children", "About 1,400 kcal a day each", h.children) +
    stepperRow("pets", "Pets", "Store their food and water too", h.pets) +
    stepperRow("days", "Days to cover", "UK advice: at least 3", h.days) + "</div></div>";
  html += '<div class="card"><div class="card-head"><h2>Allergies and diet</h2><button class="link-btn" id="diet-btn">Change</button></div>' +
    '<p class="small muted">' + esc(allergySummary(state)) + ". Recipes that may not suit you are hidden. Kept on this phone only.</p></div>";
  html += '<div class="card"><div class="card-head"><h2>Recipe cards to print</h2><span class="small muted num">' + picked.length + ' picked</span></div>' +
    '<p class="small muted">Four cards per A4 sheet, plus a dated stock list. Print it and keep it in a sleeve with your food.</p>' +
    (picked.length ? '<div class="rows">' + picked.map(function (r) { return '<div class="row-item"><div class="dot" style="background:var(--brand-soft);color:var(--brand)">' + r.serves + '</div><div class="row-main"><span class="t">' + esc(r.title) + '</span><span class="s">Serves ' + r.serves + " · " + (r.cook ? "Camping stove" : "No cooking") + '</span></div><button class="link-btn" data-recipe="' + r.id + '">View</button></div>'; }).join("") + "</div>" : '<p class="empty-line">No recipes picked yet.</p>') +
    '<button class="btn primary block" id="download-btn"' + (picked.length ? "" : " disabled") + '>Download cards to print</button>' +
    '<button class="btn block" id="pick-ready-btn">Pick every recipe I can make now</button><p class="status" id="download-status" aria-live="polite"></p></div>';
  html += '<div class="card"><div class="card-head"><h2>Be Ready kit</h2><span class="small muted num">' + done + " of " + KIT.length + '</span></div>' +
    '<p class="small muted">From the UK Government checklist. Items tick themselves when your store covers them or a photo shows them. Tick the rest by hand.</p>' +
    '<div class="bar"><i style="width:' + (done / KIT.length * 100).toFixed(1) + '%;background:var(--brand)"></i></div><ul class="check-list">' +
    KIT.map(function (k) {
      var st = kitState(k), tag = st === "auto" ? '<span class="tag">From your store</span>' : st === "photo" ? '<span class="tag tag-photo">Seen in photo</span>' : "";
      return '<li><label for="kit-' + k.id + '"><input type="checkbox" id="kit-' + k.id + '" data-kit="' + k.id + '"' + (st ? " checked" : "") + (k.auto ? " disabled" : "") + '><span>' + esc(k.label) + tag + "</span></label></li>";
    }).join("") + '</ul>' + kitCheckRow() + '<button class="btn block" data-scan-kit="1">Scan my kit with the camera</button></div>';
  html += '<div class="card"><div class="card-head"><h2>Back up your store</h2></div>' +
    '<p class="small muted">Your store is kept only on this device. Save a backup file now and then, so you can restore it on a new phone.</p>' +
    '<button class="btn block" id="backup-btn">Save a backup file</button>' +
    '<label class="btn block file-btn" for="restore-input">Restore from a backup file<input type="file" id="restore-input" accept="application/json,.json"></label>' +
    '<p class="status" id="backup-status" aria-live="polite"></p></div>';
  html += '<div class="card"><div class="card-head"><h2>Official guidance</h2></div><ul class="links">' +
    LINKS.map(function (l) { return '<li><a href="' + l[0] + '" target="_blank" rel="noopener">' + esc(l[1]) + ' ↗</a><span class="small muted">' + esc(l[2]) + "</span></li>"; }).join("") +
    '</ul><p class="small muted">Links checked 26 November 2026.</p></div>' +
    '<p class="small muted disclaimer">Pantry Prep gives general guidance, not medical or dietary advice. Check allergens on packs and follow official emergency advice first.</p>';
  $("screen-prepare").innerHTML = html;
}

function renderAll() { renderTop(); renderHome(); renderStore(); renderRecipes(); renderPrepare(); }
function changed() { save(); renderAll(); if (sheetKind === "recipe" && sheetArg) openRecipe(sheetArg, true); if (sheetKind === "item" && sheetArg) openItem(sheetArg, true); }

function go(name) {
  ui.screen = name;
  ["home", "store", "recipes", "prepare"].forEach(function (n) { $("screen-" + n).hidden = n !== name; });
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) { if (b.dataset.go === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  renderTop(); window.scrollTo(0, 0);
  try { sessionStorage.setItem("pp-screen", name); } catch (e) {}
}

var toastT;
function toast(msg) { var el = $("toast"); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 2200); }

// ---------- Sheets ----------
var sheetKind = null, sheetArg = null, lastFocus = null;
function openSheet(title, kind, arg) {
  if (!sheetKind) lastFocus = document.activeElement;
  sheetKind = kind; sheetArg = arg || null;
  $("sheet-h").textContent = title; $("sheet-extra").innerHTML = ""; $("sheet-body").innerHTML = "";
  $("scrim").hidden = false; $("sheet").hidden = false; document.body.style.overflow = "hidden";
  setTimeout(function () { $("sheet-close").focus(); }, 30);
}
function closeSheet() {
  if (ctl) ctl.abort();
  stopBarcode(); delete $("sheet-body").dataset.pane;
  sheetKind = null; sheetArg = null; $("scrim").hidden = true; $("sheet").hidden = true; document.body.style.overflow = "";
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
$("sheet-close").addEventListener("click", closeSheet);
$("scrim").addEventListener("click", closeSheet);
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheetKind) closeSheet(); });

// Add food sheet
var addMode = "search", addGroup = "all", query = "";
function openAdd(group) {
  addGroup = group || "all"; query = "";
  openSheet("Add food", "add");
  $("sheet-extra").innerHTML = '<div class="seg" role="tablist"><button role="tab" data-mode="search" aria-selected="' + (addMode === "search") + '">Search foods</button><button role="tab" data-mode="barcode" aria-selected="' + (addMode === "barcode") + '">Barcode</button><button role="tab" data-mode="scan" aria-selected="' + (addMode === "scan") + '">Scan a photo</button></div>';
  renderAdd();
}
function renderAdd() {
  Array.prototype.forEach.call(document.querySelectorAll("[data-mode]"), function (b) { b.setAttribute("aria-selected", String(b.dataset.mode === addMode)); });
  if (addMode === "barcode") { renderBarcodePane($("sheet-body"), barcodeHost); return; }
  stopBarcode(); delete $("sheet-body").dataset.pane;
  if (addMode === "scan") { renderScanPane(); return; }
  $("sheet-body").innerHTML =
    '<label class="search" for="food-q"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg><input id="food-q" type="text" placeholder="Search tins, packets, water…" autocomplete="off" value="' + esc(query) + '"></label>' +
    '<div class="chips">' + [["all", "All"]].concat(GROUP_ORDER.map(function (g) { return [g, GROUPS[g].label]; })).map(function (c) { return '<button class="chip" data-agroup="' + c[0] + '" aria-pressed="' + (addGroup === c[0]) + '">' + esc(c[1]) + "</button>"; }).join("") + "</div>" +
    '<div class="card" style="padding:4px 16px"><div class="rows" id="food-results"></div></div>';
  renderResults();
}
function renderResults() {
  var q = query.trim().toLowerCase();
  var res = CATALOGUE.filter(function (c) { return (addGroup === "all" || c.group === addGroup) && (!q || (c.name + " " + c.pack + " " + KINDS[c.kind]).toLowerCase().indexOf(q) >= 0); });
  var counts = {}; state.items.forEach(function (it) { if (it.cat) counts[it.cat] = (counts[it.cat] || 0) + it.count; });
  $("food-results").innerHTML = res.length ? res.map(function (c) {
    return '<div class="row-item"><div class="dot" style="background:color-mix(in srgb,' + GCOL[c.group] + ' 15%,transparent);color:' + GCOL[c.group] + '">' + GSHORT[c.group] + '</div>' +
      '<div class="row-main"><span class="t">' + esc(c.name) + '</span><span class="s num">' + esc(c.pack) + " · " + (c.group === "water" ? c.litres + " L" : fmt(c.kcal) + " kcal") + (counts[c.id] ? " · " + counts[c.id] + " in store" : "") + '</span></div>' +
      '<button class="add-round" data-quick="' + c.id + '" aria-label="Add one ' + esc(c.name) + '">+</button></div>';
  }).join("") : '<p class="empty-line">No match. Try another word, or scan a photo instead.</p>';
}

// Recipe detail sheet
function openRecipe(id, refresh) {
  var r = RECIPES.find(function (x) { return x.id === id; }); if (!r) return;
  var s = recipeStatus(r), on = state.picked.indexOf(r.id) >= 0;
  if (!refresh) openSheet(r.title, "recipe", id);
  $("sheet-body").innerHTML =
    '<div class="meta">' + matchBadge(s) + "<span>Serves " + r.serves + "</span><span>" + (r.cook ? "Camping stove" + (r.water ? ", " + r.water + " L water" : "") : "No cooking") + "</span></div>" +
    '<div class="card"><h2 style="font-size:1rem">You need</h2><ul class="need-list">' + r.ings.map(function (i) {
      var got = i.k.some(function (k) { return s.held[k]; });
      return "<li><span>" + esc(ingLabel(i)) + ' <span class="muted small">' + esc(i.q) + "</span></span>" + '<span class="ing ' + (got ? "have" : i.opt ? "" : "miss") + '">' + (got ? "In store" : i.opt ? "Optional" : "Need") + "</span></li>";
    }).join("") + "</ul></div>" +
    allergenCard(r) +
    '<div class="card"><h2 style="font-size:1rem">Method</h2><ol class="steps-list">' + r.steps.map(function (st) { return "<li>" + esc(st) + "</li>"; }).join("") + "</ol></div>" +
    '<button class="btn ' + (on ? "" : "primary") + ' block" data-toggle-pick="' + r.id + '">' + (on ? "Remove from print cards" : "Add to print cards") + "</button>";
}

function openAbout() {
  openSheet("How we count", "about");
  var tg = targets();
  $("sheet-body").innerHTML = '<div class="card"><p><b>Water</b> uses the UK Government figure: 3 litres per person per day for drinking. Plan more for cooking, washing, baby formula and pets.</p>' +
    "<p><b>Food</b> targets are approximate UK reference intakes for a short emergency: 2,000 kcal, 50 g protein and 30 g fibre per adult per day, and about 1,400 kcal, 30 g protein and 20 g fibre per child.</p>" +
    "<p><b>Balanced plate</b> follows the Eatwell Guide groups: 5 portions of fruit and veg, 3 of starchy carbs, 2 of protein and 2 of dairy per person per day.</p>" +
    '<p class="small muted num">Your household needs ' + fmt(tg.water) + " L water and " + fmt(tg.kcal) + " kcal in total. Nutrition per pack is a typical label figure, and scanned items are estimates.</p></div>";
}

// ---------- Allergies and diet ----------
function allergenCard(r) {
  var list = recipeAllergens(r), why = whyNot(r);
  return '<div class="card"><h2 style="font-size:1rem">Allergens</h2>' + (why ? '<p class="warn-text small">' + esc(why) + ".</p>" : "") +
    '<p class="small">' + (list.length ? "May contain: " + esc(list.map(function (a) { return ALLERGENS[a].toLowerCase(); }).join(", ")) + "." : "None of the 14 major allergens is usual in these ingredients.") +
    ' <span class="muted">Brands differ, so always check the label.</span></p></div>';
}
function openDiet(refresh) {
  if (!refresh) openSheet("Allergies and diet", "diet");
  $("sheet-body").innerHTML = '<p class="small muted">We hide recipes that may contain these. This stays on your phone and is never sent anywhere.</p><div class="card">' + allergyPickerHTML(state) + "</div>" +
    '<button class="btn primary block" id="sheet-done">Done</button>';
}

// ---------- Barcode scan (see barcode.ts) ----------
var barcodeHost = {
  add: function (d, n) {
    var ex = state.items.find(function (x) { return x.code === d.code && !x.bb; });
    if (ex) ex.count += n;
    else state.items.push({ uid: uid(), cat: null, code: d.code, name: d.name, pack: d.pack, group: d.group, kind: d.kind, kcal: d.kcal, protein: d.protein, fibre: d.fibre, portions: d.portions, litres: d.litres, count: n });
    save(); renderAll();
  },
  toast: function (m) { toast(m); }
};

// ---------- Best-before dates ----------
function bbTag(it) {
  var st = expiryStatus(it.bb, todayIso());
  if (!st || st === "ok") return "";
  return '<span class="tag tag-' + st + '">' + (st === "expired" ? "Past date" : "Use soon") + "</span>";
}
function useSoonCard() {
  var e = expiring(state.items, todayIso()), list = e.expired.concat(e.soon);
  if (!list.length) return "";
  return '<div class="card"><div class="card-head"><h2>Eat and replace</h2><span class="status-chip st-' + (e.expired.length ? "bad" : "warn") + '">' + plural(list.length, "item", "items") + '</span></div>' +
    '<p class="small muted">Use these in a meal soon and buy a fresh one to keep your store topped up.</p><div class="rows">' +
    list.slice(0, 5).map(function (it) {
      var st = expiryStatus(it.bb, todayIso());
      return '<div class="row-item"><div class="dot" style="background:color-mix(in srgb,var(--' + (st === "expired" ? "bad" : "warn") + ') 15%,transparent);color:var(--' + (st === "expired" ? "bad" : "warn") + ')" aria-hidden="true">!</div>' +
        '<button class="row-main row-btn" data-item="' + esc(it.uid) + '"><span class="t">' + esc(it.name) + '</span><span class="s">' + esc(expiryPhrase(it.bb, todayIso())) + "</span></button><span></span></div>";
    }).join("") + (list.length > 5 ? '<p class="empty-line">And ' + (list.length - 5) + ' more in your store.</p>' : "") + "</div></div>";
}
function openItem(id, refresh) {
  var it = state.items.find(function (x) { return x.uid === id; });
  if (!it) { if (refresh) closeSheet(); return; }
  if (!refresh) openSheet(it.name, "item", id);
  var right = it.group === "water" ? fmt(it.litres * it.count) + " L" : fmt(it.kcal * it.count) + " kcal";
  $("sheet-body").innerHTML =
    '<div class="card" data-uid="' + esc(it.uid) + '"><div class="set-row"><div class="row-main"><span class="t">How many</span><span class="s num">' + esc(it.pack || "Pack") + " · " + right + " in total</span></div>" +
    '<div class="stepper"><button data-step="-1" aria-label="One fewer">−</button><span class="num">' + esc(it.count) + '</span><button data-step="1" aria-label="One more">+</button></div></div>' +
    '<label class="field" for="bb-input"><span class="t">Best-before date</span><span class="s">Use the earliest date if your packs differ. We remind you ' + 30 + ' days ahead.</span>' +
    '<input type="date" id="bb-input" data-bb="' + esc(it.uid) + '" value="' + esc(it.bb || "") + '"></label>' +
    (it.bb ? '<p class="small ' + (expiryStatus(it.bb, todayIso()) === "ok" ? "muted" : "warn-text") + '">' + esc(expiryPhrase(it.bb, todayIso())) + "</p>" : "") +
    "</div>" +
    '<div class="card"><p class="small muted num">Per pack: ' + (it.group === "water" ? fmt(it.litres) + " L water" : fmt(it.kcal) + " kcal, " + fmt(it.protein) + " g protein, " + fmt(it.fibre) + " g fibre") + "." + (it.cat ? " Typical UK label figure." : " Estimated, so check the pack.") + "</p></div>" +
    '<button class="btn danger block" data-remove-item="' + esc(it.uid) + '">Remove from store</button>';
}
function kitCheckRow() {
  var due = kitCheckDue(state.kitChecked, todayIso());
  return '<div class="kit-check' + (due ? " due" : "") + '"><div class="row-main"><span class="t">' + (state.kitChecked ? "Last checked " + esc(formatDate(state.kitChecked)) : "Not checked yet") + '</span>' +
    '<span class="s">' + (due ? "Look through your kit every 3 months: test torches and radios, swap old batteries and medicines." : "Next check due in about 3 months.") + "</span></div>" +
    '<button class="btn' + (due ? " primary" : "") + '" id="kit-checked-btn">I checked it today</button></div>';
}

// ---------- Photo scan ----------
var sampleP = (window.claude && window.claude.use) ? window.claude.use("sample").catch(function () { return null; }) : Promise.resolve(null);
var scanAvail = null, maxImages = 4, files = [], ctl = null, scanned = [], scanMsg = "";
sampleP.then(function (s) {
  if (!s) { scanAvail = false; if (sheetKind === "add" && addMode === "scan") renderScanPane(); return; }
  return s.limits().then(function (l) { scanAvail = !!(l && l.images); maxImages = (l && l.images && l.images.maxCount) || 4; }, function () { scanAvail = false; })
    .then(function () { if (sheetKind === "add" && addMode === "scan") renderScanPane(); });
});
function renderScanPane() {
  var b = $("sheet-body");
  if (scanAvail === false) { b.innerHTML = '<div class="drop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg><b>Photo scanning is coming soon.</b><span class="small muted">For now, add food from Search foods. Barcode scanning is planned next.</span></div>'; return; }
  var html = '<div class="drop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>' +
    "<b>Photograph your shelves and kit</b><span class=\"small muted\">Spread tins out with labels facing the camera. Torches, radios, batteries and first aid kits are ticked off your Be Ready list too. Up to " + maxImages + " photos at a time.</span>" +
    '<label class="file-label" for="photo-input">' + (files.length ? "Choose different photos" : "Take or choose photos") + '<input type="file" id="photo-input" accept="image/jpeg,image/png,image/webp" multiple></label>' +
    '<div class="thumbs" id="thumbs"></div></div>';
  if (files.length && !scanned.length) html += '<button class="btn primary block" id="scan-btn"' + (ctl ? " disabled" : "") + ">" + (ctl ? "Looking at your photos…" : "Find food in " + plural(files.length, "photo", "photos")) + "</button>" + (ctl ? '<button class="btn block" id="stop-btn">Stop</button>' : "");
  html += '<p class="status" aria-live="polite">' + esc(scanMsg) + "</p>";
  if (scanned.length) {
    html += '<div class="card" style="padding:6px 16px"><div class="rows">' + scanned.map(function (s, i) {
      return '<div class="scan-row"><input type="checkbox" id="sk-' + i + '" data-i="' + i + '" data-f="keep"' + (s.keep ? " checked" : "") + ' aria-label="Keep this item">' +
        '<div class="row-main"><input type="text" id="sn-' + i + '" data-i="' + i + '" data-f="name" value="' + esc(s.name) + '" aria-label="Item name"><span class="s">' + esc(GROUPS[s.group].label) + (s.cat ? "" : " · estimate") + ' <span class="conf ' + s.conf + '">' + s.conf + '</span></span></div>' +
        '<div class="stepper"><button data-sstep="-1" data-i="' + i + '" aria-label="Fewer">−</button><span class="num">' + s.count + '</span><button data-sstep="1" data-i="' + i + '" aria-label="More">+</button></div></div>';
    }).join("") + '</div></div><button class="btn primary block" id="scan-add">Add ' + plural(scanned.filter(function (s) { return s.keep; }).length, "item", "items") + " to store</button>";
  }
  b.innerHTML = html;
  var th = $("thumbs");
  files.forEach(function (f) { var img = document.createElement("img"); img.alt = "Photo to scan"; img.src = f._url; th.appendChild(img); });
}
function scanPrompt() {
  var cat = CATALOGUE.map(function (c) { return c.id + ": " + c.name + " (" + c.pack + ")"; }).join("\n");
  return "These photos show part of a UK household's emergency store. Do two things.\n\n1. List every food or drink product you can see.\n" +
    "For each distinct product give one entry. If it is the same kind of product as one of these catalogue items, set \"id\" to that catalogue id; otherwise set \"id\" to null and estimate nutrition for one pack from typical UK labels.\n\nCatalogue:\n" + cat + "\n\n" +
    "\"kind\" must be one of: " + Object.keys(KINDS).join(", ") + ", or null.\n\"group\" must be one of: water, fruitveg, starchy, protein, dairy, oils, other.\n" +
    "Count every visible pack. If packs are stacked or partly hidden, give your best count and set confidence to \"low\".\n\n" +
    "2. Say which of these emergency kit items are clearly visible (only include an id if you can actually see that item):\n" +
    KIT.filter(function (k) { return k.look; }).map(function (k) { return k.id + ": " + k.look; }).join("\n") + "\n\n" +
    'Reply with only a JSON object like:\n{"food":[{"id":"tuna","name":"Tuna chunks in spring water","pack":"145 g tin","count":3,"kind":"fish","group":"protein","kcal":110,"protein":25,"fibre":0,"litres":0,"portions":1,"confidence":"high"}],"kit":["torch","batteries"]}';
}
function kitFrom(data) {
  var ids = data && Array.isArray(data.kit) ? data.kit : [];
  return KIT.filter(function (k) { return k.look && ids.indexOf(k.id) >= 0; });
}
function normalise(data) {
  if (data && !Array.isArray(data)) data = data.food;
  if (!Array.isArray(data)) return [];
  return data.slice(0, 60).map(function (d) {
    d = d || {};
    var id = typeof d.id === "string" && CAT[d.id] ? d.id : null, base = id ? CAT[id] : null;
    return { keep: true, cat: id, conf: ["high", "medium", "low"].indexOf(d.confidence) >= 0 ? d.confidence : "medium",
      name: String(d.name || (base && base.name) || "Unknown item").slice(0, 80), pack: String(d.pack || (base && base.pack) || "").slice(0, 30),
      count: Math.round(num(d.count, 1, 99, 1)), group: base ? base.group : (GROUPS[d.group] ? d.group : "other"), kind: base ? base.kind : (KINDS[d.kind] ? d.kind : null),
      kcal: base ? base.kcal : num(d.kcal, 0, 5000, 0), protein: base ? base.protein : num(d.protein, 0, 300, 0), fibre: base ? base.fibre : num(d.fibre, 0, 200, 0),
      portions: base ? base.portions : num(d.portions, 0, 30, 0), litres: base ? (base.litres || 0) : num(d.litres, 0, 20, 0) };
  });
}
function runScan() {
  ctl = new AbortController(); scanMsg = "This can take up to a minute."; renderScanPane();
  var myCtl = ctl;
  sampleP.then(function (s) {
    if (!s) return;
    return s.json(scanPrompt(), { images: files, signal: myCtl.signal }).then(function (data) {
      scanned = normalise(data);
      var seen = kitFrom(data).filter(function (k) { return !state.kit[k.id]; });
      seen.forEach(function (k) { state.kit[k.id] = "photo"; });
      if (seen.length) { save(); renderAll(); }
      var kitMsg = seen.length ? " Ticked off on your kit list: " + seen.map(function (k) { return k.label.split(" (")[0]; }).join(", ") + "." : "";
      scanMsg = (scanned.length ? "Found " + plural(scanned.length, "food product", "food products") + ". Untick or fix anything wrong, then add." : "No food found in these photos.") + kitMsg;
    }, function (err) {
      var c = err && err.code;
      scanMsg = { cancelled: "Stopped.", not_granted: "Photo scanning needs your permission to use Claude. You can still search foods.", rate_limited: "Too many scans just now. Try again in a few minutes.",
        image_rejected: "One photo could not be read. Use a JPEG or PNG under 20 MB.", invalid_json: "The scan came back in an unexpected format. Try again.", refused: "That photo could not be scanned. Try another." }[c] || "The scan did not finish. Check your connection and try again.";
      if (c === "not_granted" || c === "sampling_disabled") scanAvail = false;
    });
  }).then(function () { if (ctl === myCtl) ctl = null; if (sheetKind === "add" && addMode === "scan") renderScanPane(); });
}

// ---------- Print file ----------
function pickedRecipes() { return RECIPES.filter(function (r) { return state.picked.indexOf(r.id) >= 0; }); }
function cardHTML(r) {
  return '<div class="card"><div class="band"><span>' + (r.cook ? "Stove" + (r.water ? " · " + r.water + " L water" : "") : "No cook") + "</span><span>Serves " + r.serves + "</span></div><h3>" + esc(r.title) + "</h3><b>You need</b><ul>" +
    r.ings.map(function (i) { return "<li>" + esc(ingLabel(i)) + ": " + esc(i.q) + (i.opt ? " (optional)" : "") + "</li>"; }).join("") + "</ul><b>Method</b><ol>" +
    r.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></div>";
}
function buildPrintFile() {
  var p = pickedRecipes(), t = totals(), tg = targets(), pages = [];
  var today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  for (var i = 0; i < p.length; i += 4) pages.push(p.slice(i, i + 4));
  var rows = state.items.map(function (it) { return "<tr><td>" + esc(it.name) + "</td><td>" + esc(it.pack || "") + "</td><td>" + esc(it.count) + "</td><td>" + (it.bb ? esc(formatDate(it.bb)) : "&nbsp;") + "</td></tr>"; }).join("");
  return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Pantry Prep cards</title><style>' +
    "@page{size:A4;margin:10mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:10.5pt}" +
    ".sheet{width:190mm;height:277mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6mm;break-after:page;page-break-after:always}" +
    ".card{border:1.5pt dashed #333;border-radius:3mm;padding:5mm;overflow:hidden}.band{background:#0e7a62;color:#fff;margin:-5mm -5mm 3mm;padding:2mm 5mm;font-weight:bold;font-size:8.5pt;letter-spacing:.06em;text-transform:uppercase;display:flex;justify-content:space-between;border-radius:3mm 3mm 0 0}" +
    "h3{font-size:14pt;margin:0 0 2mm}ul,ol{margin:1mm 0 3mm;padding-left:5mm}li{margin-bottom:.8mm}.cover{break-after:page;page-break-after:always}" +
    "table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:1.5mm 2mm;text-align:left}h1{font-size:20pt;margin:0 0 2mm}.note{color:#444;font-size:9pt}" +
    "@media screen{body{padding:10mm;background:#ddd}.sheet,.cover{background:#fff;margin:0 auto 10mm;padding:10mm;box-sizing:content-box}.tip{max-width:190mm;margin:0 auto 6mm;background:#e3f4ee;padding:4mm;border:1px solid #0e7a62}}@media print{.tip{display:none}}" +
    '</style></head><body><div class="tip">Print this page on A4 (File, then Print). Cut along the dashed lines and keep the cards with your food store.</div>' +
    '<div class="cover"><h1>Emergency food store</h1><p>Checked on ' + esc(today) + ". Covers " + plural(state.house.adults, "adult", "adults") + " and " + plural(state.house.children, "child", "children") + " for " + plural(state.house.days, "day", "days") + ".</p>" +
    "<p>Food: about " + fmt(t.kcal) + " of " + fmt(tg.kcal) + " kcal needed. Water: " + fmt(t.water) + " of " + fmt(tg.water) + " L needed (3 L per person per day for drinking).</p>" +
    "<table><thead><tr><th>Item</th><th>Pack</th><th>Count</th><th>Best before</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    '<p class="note">UK Government advice: beready.campaign.gov.uk. Eat and replace items before their best-before date.</p></div>' +
    pages.map(function (pg) { return '<div class="sheet">' + pg.map(cardHTML).join("") + "</div>"; }).join("") + "</body></html>";
}
var downloadsP = (window.claude && window.claude.use) ? window.claude.use("downloads").catch(function () { return null; }) : Promise.resolve(null);
function download() {
  var st = $("download-status"); st.textContent = "Preparing your cards…";
  var html = buildPrintFile();
  downloadsP.then(function (dl) {
    if (!dl) {
      // Normal browser: open the printable page in a new tab, or save it if pop-ups are blocked.
      var url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      var w = window.open(url, "_blank");
      if (!w) saveFile("pantry-prep-cards.html", html, "text/html");
      st.textContent = w ? "Your cards opened in a new tab. Print them on A4." : "Saved. Open the file and print it on A4.";
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return;
    }
    return dl.save({ filename: "pantry-prep-cards.html", data: new Blob([html], { type: "text/html" }) }).then(function (res) {
      st.textContent = res && res.status === "saved" ? "Saved. Open the file and print it on A4." : "Sent to the place you chose.";
    }, function (err) {
      var c = err && err.code;
      st.textContent = c === "cancelled" || c === "declined" ? "Download cancelled." : "The cards could not be saved here. Try a browser on a computer.";
    });
  });
}
function saveFile(name, text, type) {
  return downloadsP.then(function (dl) {
    if (dl) return dl.save({ filename: name, data: new Blob([text], { type: type }) });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
  });
}

// ---------- Events ----------
document.addEventListener("click", function (e) {
  var el = e.target.closest("button, [data-go]"); if (!el) return;
  var d = el.dataset;
  if (d.go) { go(d.go); return; }
  if (el.id === "fab") { openAdd(); return; }
  if (el.id === "house-btn") { go("prepare"); return; }
  if (d.sheet === "about") { openAbout(); return; }
  if (d.recipe) { openRecipe(d.recipe); return; }
  if (d.item) { openItem(d.item); return; }
  if ((d.allergen || d.diet) && !el.closest(".onboard")) {
    if (applyPickerClick(el, state)) { changed(); openDiet(true); var pf = document.querySelector(d.allergen ? '[data-allergen="' + d.allergen + '"]' : '[data-diet="' + d.diet + '"]'); if (pf) pf.focus(); }
    return;
  }
  if (el.id === "diet-btn") { openDiet(); return; }
  if (el.id === "sheet-done") { closeSheet(); return; }
  if (el.id === "toggle-unsuitable") { ui.showUnsuitable = !ui.showUnsuitable; renderRecipes(); var tu = $("toggle-unsuitable"); if (tu) tu.focus(); return; }
  if (d.removeItem) { var gone = state.items.find(function (x) { return x.uid === d.removeItem; }); state.items = state.items.filter(function (x) { return x.uid !== d.removeItem; }); closeSheet(); changed(); if (gone) toast("Removed " + gone.name); return; }
  if (el.id === "kit-checked-btn") { state.kitChecked = todayIso(); changed(); toast("Kit check saved"); var kb = $("kit-checked-btn"); if (kb) kb.focus(); return; }
  if (d.togglePick) {
    var id = d.togglePick, on = state.picked.indexOf(id) >= 0;
    state.picked = state.picked.filter(function (x) { return x !== id; }); if (!on) state.picked.push(id);
    toast(on ? "Removed from print cards" : "Added to print cards"); changed(); return;
  }
  if (d.filter) { ui.filter = d.filter; renderRecipes(); return; }
  if (d.buy) { addItem(fromCat(d.buy, Number(d.n) || 1)); toast("Logged " + d.n + " × " + CAT[d.buy].name); changed(); return; }
  if (d.step) {
    var row = el.closest("[data-uid]"), it = row && state.items.find(function (x) { return x.uid === row.dataset.uid; });
    if (!it) return;
    it.count += Number(d.step); if (it.count <= 0) state.items = state.items.filter(function (x) { return x !== it; });
    changed(); return;
  }
  if (d.scanKit) { addMode = "scan"; openAdd(); return; }
  if (d.addgroup) { addMode = "search"; openAdd(d.addgroup); return; }
  if (d.clear === "ask") { el.parentNode.innerHTML = '<span class="small"><b>Remove every example item?</b></span><button class="btn danger" data-clear="yes">Clear</button><button class="btn" data-clear="no">Keep</button>'; return; }
  if (d.clear === "yes") { state.items = []; state.example = false; state.picked = []; changed(); toast("Example cleared. Tap + to add your food."); return; }
  if (d.clear === "no") { renderStore(); return; }
  if (d.house) {
    var k = d.house, lim = k === "days" ? [1, 30] : [0, 20];
    state.house[k] = Math.min(lim[1], Math.max(lim[0], state.house[k] + Number(d.d)));
    if (people() === 0) state.house.adults = 1;
    changed(); return;
  }
  if (d.mode) { addMode = d.mode; renderAdd(); return; }
  if (d.agroup) { addGroup = d.agroup; renderAdd(); var q = $("food-q"); if (q) q.focus(); return; }
  if (d.quick) {
    addItem(fromCat(d.quick, 1)); save(); renderAll(); renderResults();
    toast("Added " + CAT[d.quick].name); return;
  }
  if (el.id === "scan-btn") { runScan(); return; }
  if (el.id === "stop-btn") { if (ctl) ctl.abort(); return; }
  if (d.sstep) { var s = scanned[Number(d.i)]; s.count = Math.max(1, Math.min(99, s.count + Number(d.sstep))); renderScanPane(); return; }
  if (el.id === "scan-add") {
    var n = 0;
    scanned.forEach(function (s) { if (!s.keep) return; n += 1; addItem({ uid: uid(), cat: s.cat, name: s.name, pack: s.pack, group: s.group, kind: s.kind, kcal: s.kcal, protein: s.protein, fibre: s.fibre, portions: s.portions, litres: s.litres, count: s.count }); });
    scanned = []; files = []; scanMsg = ""; changed(); closeSheet(); go("store"); toast("Added " + plural(n, "item", "items") + " from your photos"); return;
  }
  if (el.id === "download-btn") { download(); return; }
  if (el.id === "backup-btn") {
    var name = "pantry-prep-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    Promise.resolve(saveFile(name, toBackup(state), "application/json")).then(function () { $("backup-status").textContent = "Backup saved as " + name + "."; },
      function () { $("backup-status").textContent = "The backup could not be saved here."; });
    return;
  }
  if (el.id === "pick-ready-btn") {
    state.picked = sortedRecipes().filter(function (x) { return x.s.ready; }).map(function (x) { return x.r.id; });
    changed(); $("download-status").textContent = state.picked.length ? "Picked " + plural(state.picked.length, "recipe", "recipes") + " you can make now." : "No recipe can be made from your store yet."; return;
  }
});
document.addEventListener("input", function (e) {
  var t = e.target;
  if (t.id === "food-q") { query = t.value; renderResults(); return; }
  if (t.dataset.f && t.dataset.i != null) {
    var s = scanned[Number(t.dataset.i)]; if (!s) return;
    if (t.dataset.f === "name") s.name = t.value.slice(0, 80);
    if (t.dataset.f === "keep") { s.keep = t.checked; var b = $("scan-add"); if (b) b.textContent = "Add " + plural(scanned.filter(function (x) { return x.keep; }).length, "item", "items") + " to store"; }
  }
});
document.addEventListener("change", function (e) {
  var t = e.target;
  if (t.id === "photo-input") {
    files = Array.prototype.slice.call(t.files || [], 0, maxImages);
    files.forEach(function (f) { f._url = URL.createObjectURL(f); });
    scanned = []; scanMsg = (t.files || []).length > maxImages ? "Using the first " + maxImages + " photos." : ""; renderScanPane(); return;
  }
  if (t.id === "restore-input" && t.files && t.files[0]) {
    t.files[0].text().then(function (txt) {
      var restored = fromBackup(txt);
      if (!restored) { $("backup-status").textContent = "That file is not a Pantry Prep backup."; return; }
      state = restored; changed(); toast("Store restored from backup");
    });
    return;
  }
  if (t.dataset.bb) {
    var bit = state.items.find(function (x) { return x.uid === t.dataset.bb; }); if (!bit) return;
    if (isIsoDate(t.value)) bit.bb = t.value; else delete bit.bb;
    changed(); var bi = $("bb-input"); if (bi) bi.focus(); return;
  }
  if (t.dataset.kit != null) { if (t.checked) state.kit[t.dataset.kit] = "hand"; else delete state.kit[t.dataset.kit]; save(); renderPrepare(); var again = $("kit-" + t.dataset.kit); if (again) again.focus(); }
});

// ---------- Boot ----------
renderAll();
if (!state.onboarded) {
  showOnboarding(state, function (keepExample) {
    if (!keepExample) { state.items = []; state.example = false; state.picked = []; }
    changed(); go(keepExample ? "home" : "store");
    if (!keepExample) toast("Tap + to add your first food");
  });
}
try { var sc = sessionStorage.getItem("pp-screen"); if (sc && $("screen-" + sc)) go(sc); } catch (e) {}

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", function () { navigator.serviceWorker.register("./sw.js").catch(function () {}); });
}
