// Welcome screens on first visit: household and days, then allergies and diet.
// The same allergy picker is reused in the Prepare tab.
import { ALLERGENS, DIETS, type AllergenId, type Diet } from "./allergens";
import type { AppState } from "./calc";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Allergen toggles and diet choice. Buttons carry data-allergen / data-diet. */
export function allergyPickerHTML(state: AppState): string {
  return `<fieldset class="picker"><legend>Allergies to avoid</legend><div class="chips wrap">` +
    (Object.keys(ALLERGENS) as AllergenId[]).map((a) =>
      `<button type="button" class="chip" data-allergen="${a}" aria-pressed="${state.allergies.includes(a)}">${esc(ALLERGENS[a])}</button>`).join("") +
    `</div></fieldset><fieldset class="picker"><legend>Diet</legend><div class="chips wrap" role="radiogroup">` +
    (Object.keys(DIETS) as Diet[]).map((d) =>
      `<button type="button" class="chip" role="radio" data-diet="${d}" aria-checked="${state.diet === d}">${esc(DIETS[d])}</button>`).join("") +
    `</div></fieldset>`;
}

/** Applies a click on an allergy or diet button. Returns true if it changed the state. */
export function applyPickerClick(el: HTMLElement, state: AppState): boolean {
  const a = el.dataset.allergen as AllergenId | undefined;
  const d = el.dataset.diet as Diet | undefined;
  if (a && a in ALLERGENS) {
    state.allergies = state.allergies.includes(a) ? state.allergies.filter((x) => x !== a) : [...state.allergies, a];
    return true;
  }
  if (d && d in DIETS) { state.diet = d; return true; }
  return false;
}

export function allergySummary(state: AppState): string {
  const parts: string[] = state.allergies.map((a) => ALLERGENS[a]);
  if (state.diet !== "none") parts.unshift(DIETS[state.diet]);
  return parts.length ? parts.join(", ") : "None set";
}

const stepper = (key: string, label: string, sub: string, val: number) =>
  `<div class="set-row"><div class="row-main"><span class="t">${label}</span><span class="s">${sub}</span></div>` +
  `<div class="stepper"><button type="button" data-ob-house="${key}" data-d="-1" aria-label="Fewer ${label.toLowerCase()}">−</button>` +
  `<span class="num" aria-live="polite">${val}</span><button type="button" data-ob-house="${key}" data-d="1" aria-label="More ${label.toLowerCase()}">+</button></div></div>`;

/**
 * Shows the welcome flow over the app. `done(useExample)` runs when the person finishes:
 * true keeps the example store to explore, false starts with an empty store.
 */
export function showOnboarding(state: AppState, done: (keepExample: boolean) => void) {
  let step = 0;
  const lastFocus = document.activeElement as HTMLElement | null;
  const root = document.createElement("div");
  root.className = "onboard";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "ob-h");
  document.body.appendChild(root);
  document.body.style.overflow = "hidden";
  const app = document.querySelector<HTMLElement>(".app"), nav = document.querySelector<HTMLElement>(".tabbar");
  app?.setAttribute("inert", ""); nav?.setAttribute("inert", "");

  const dots = () => `<div class="ob-dots" aria-hidden="true">${[0, 1, 2].map((i) => `<i${i === step ? ' class="on"' : ""}></i>`).join("")}</div>`;

  function render() {
    const h = state.house;
    let body = "";
    if (step === 0) {
      body = `<div class="ob-hero"><img src="./icon.svg" alt="" width="84" height="84"></div>
        <h1 id="ob-h">Be ready for three days</h1>
        <p>If shops, power or water stop for a few days, would your home have enough to eat and drink? Pantry Prep helps you build a store that lasts, following the UK Government's <b>Be Ready</b> advice.</p>
        <ul class="ob-points"><li>See how many days your food and water last</li><li>Get a shopping list that fills the gaps</li><li>Find meals you can make without power, and print recipe cards</li></ul>
        <p class="small muted">Everything stays on this phone. No account, no sign-up.</p>
        <button class="btn primary block" data-ob="next">Get started</button>`;
    } else if (step === 1) {
      body = `<p class="ob-step">Step 1 of 2</p><h1 id="ob-h">Who lives with you?</h1>
        <p class="muted">We use this to work out how much food and water you need.</p>
        <div class="card">${stepper("adults", "Adults", "Ages 11 and over", h.adults)}${stepper("children", "Children", "Ages 10 and under", h.children)}${stepper("pets", "Pets", "So you remember their food and water", h.pets)}</div>
        <div class="card"><div class="row-main"><span class="t">How many days to cover?</span><span class="s">The government advises at least 3 days.</span></div>
        <div class="chips" role="radiogroup" aria-label="Days to cover">${[3, 7, 14].map((d) => `<button type="button" class="chip" role="radio" data-ob-days="${d}" aria-checked="${h.days === d}">${d} days</button>`).join("")}</div></div>
        <button class="btn primary block" data-ob="next">Continue</button><button class="btn block" data-ob="back">Back</button>`;
    } else {
      body = `<p class="ob-step">Step 2 of 2</p><h1 id="ob-h">Any allergies or diets?</h1>
        <p class="muted">We'll hide recipes that may not suit you. This stays on your phone. Always check labels, as brands differ.</p>
        <div class="card">${allergyPickerHTML(state)}</div>
        <button class="btn primary block" data-ob="empty">Start my store</button>
        <button class="btn block" data-ob="example">Look around an example store first</button>
        <button class="btn block ghost" data-ob="back">Back</button>`;
    }
    root.innerHTML = `<div class="ob-inner">${dots()}${body}</div>`;
  }

  function finish(keepExample: boolean) {
    state.onboarded = true;
    root.remove();
    document.body.style.overflow = "";
    app?.removeAttribute("inert"); nav?.removeAttribute("inert");
    done(keepExample);
    lastFocus?.focus?.();
  }

  root.addEventListener("click", (e) => {
    // The app's own click handler must not see these (the button is re-rendered away).
    e.stopPropagation();
    const el = (e.target as HTMLElement).closest("button");
    if (!el) return;
    const d = el.dataset;
    let focusSel = "";
    if (d.ob === "next") { step += 1; focusSel = "#ob-h"; }
    else if (d.ob === "back") { step -= 1; focusSel = "#ob-h"; }
    else if (d.ob === "empty") { finish(false); return; }
    else if (d.ob === "example") { finish(true); return; }
    else if (d.obHouse) {
      const k = d.obHouse as "adults" | "children" | "pets";
      state.house[k] = Math.min(20, Math.max(0, state.house[k] + Number(d.d)));
      if (state.house.adults + state.house.children === 0) state.house.adults = 1;
      focusSel = `[data-ob-house="${k}"][data-d="${d.d}"]`;
    } else if (d.obDays) { state.house.days = Number(d.obDays); focusSel = `[data-ob-days="${d.obDays}"]`; }
    else if (applyPickerClick(el, state)) {
      focusSel = d.allergen ? `[data-allergen="${d.allergen}"]` : `[data-diet="${d.diet}"]`;
    } else return;
    render();
    const f = root.querySelector<HTMLElement>(focusSel);
    if (f) { if (f.id === "ob-h") f.setAttribute("tabindex", "-1"); f.focus(); }
    if (focusSel === "#ob-h") root.scrollTo(0, 0);
  });

  render();
  root.querySelector<HTMLElement>("[data-ob=next]")?.focus();
}
