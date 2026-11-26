import { ALLERGENS, DIETS, type AllergenId, type Diet } from "../allergens";
import type { AppState } from "../calc";

export function allergySummary(s: AppState): string {
  const parts: string[] = s.allergies.map((a) => ALLERGENS[a]);
  if (s.diet !== "none") parts.unshift(DIETS[s.diet]);
  return parts.length ? parts.join(", ") : "None set";
}

/** Allergen toggles and a diet choice. Changes go to `onChange` as edits of the state. */
export function AllergyPicker({ state, onChange }: { state: AppState; onChange: (fn: (s: AppState) => void) => void }) {
  return (
    <>
      <fieldset className="picker">
        <legend>Allergies to avoid</legend>
        <div className="chips wrap">
          {(Object.keys(ALLERGENS) as AllergenId[]).map((a) => (
            <button type="button" key={a} className="chip" data-allergen={a} aria-pressed={state.allergies.includes(a)}
              onClick={() => onChange((s) => { s.allergies = s.allergies.includes(a) ? s.allergies.filter((x) => x !== a) : [...s.allergies, a]; })}>
              {ALLERGENS[a]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="picker">
        <legend>Diet</legend>
        <div className="chips wrap" role="radiogroup">
          {(Object.keys(DIETS) as Diet[]).map((d) => (
            <button type="button" key={d} className="chip" role="radio" data-diet={d} aria-checked={state.diet === d} onClick={() => onChange((s) => { s.diet = d; })}>
              {DIETS[d]}
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}
