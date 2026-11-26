import { useState } from "react";
import { plural, RecipeCard, sortedRecipes } from "./common";
import { useApp } from "./appState";

type Filter = "all" | "ready" | "nocook" | "picked";
const FILTERS: [Filter, string][] = [["all", "All"], ["ready", "Can make now"], ["nocook", "No cooking"], ["picked", "Print list"]];

export function Recipes() {
  const { state } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [showUnsuitable, setShowUnsuitable] = useState(false);
  const list = sortedRecipes(state, showUnsuitable);
  const ready = list.filter((x) => x.s.ready).length;
  const hidden = sortedRecipes(state, true).length - sortedRecipes(state, false).length;
  const shown = list.filter((x) => filter === "all" || (filter === "ready" && x.s.ready) || (filter === "nocook" && !x.r.cook) || (filter === "picked" && state.picked.includes(x.r.id)));

  return (
    <>
      <p className="muted small">You can make <b style={{ color: "var(--ink)" }}>{ready} of {list.length}</b> recipes with what is in your store. Tap one to see the method or add it to your print cards.</p>
      {hidden > 0 && (
        <p className="small muted">
          {showUnsuitable
            ? `Showing every recipe, including ${plural(hidden, "one", "ones")} that may not suit your allergies or diet. `
            : `${plural(hidden, "recipe is", "recipes are")} hidden because of your allergies or diet. `}
          <button className="link-btn" id="toggle-unsuitable" onClick={() => setShowUnsuitable(!showUnsuitable)}>{showUnsuitable ? "Hide them" : "Show them"}</button>
        </p>
      )}
      <div className="chips" role="group" aria-label="Filter recipes">
        {FILTERS.map(([id, label]) => <button key={id} className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      <div className="recipe-list">
        {shown.length ? shown.map((x) => <RecipeCard key={x.r.id} r={x.r} s={x.s} />) : <p className="muted">No recipes match this filter yet.</p>}
      </div>
    </>
  );
}
