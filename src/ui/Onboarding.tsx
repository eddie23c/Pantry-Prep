// Welcome screens on first visit: what the app does, household and days, then allergies and diet.
import { useEffect, useRef, useState } from "react";
import { targets, type AppState, type House } from "../calc";
import { AllergyPicker } from "./AllergyPicker";
import { CountUp, fmt, Stepper } from "./common";
import { useApp } from "./appState";

const HOUSE: [keyof House, string, string][] = [
  ["adults", "Adults", "Ages 11 and over"],
  ["children", "Children", "Ages 10 and under"],
  ["pets", "Pets", "So you remember their food and water"],
];

export function Onboarding() {
  const { state, update, go, toast } = useApp();
  const [step, setStep] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  useEffect(() => {
    if (first.current) { first.current = false; root.current?.querySelector<HTMLElement>(".btn.primary")?.focus(); return; }
    root.current?.scrollTo(0, 0);
    heading.current?.focus();
  }, [step]);

  const finish = (keepExample: boolean) => {
    update((s: AppState) => {
      s.onboarded = true;
      if (!keepExample) { s.items = []; s.example = false; s.picked = []; }
    });
    go(keepExample ? "home" : "store");
    if (!keepExample) toast("Tap + to scan or add your first food");
  };
  const h = state.house, tg = targets(h);

  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-labelledby="ob-h" ref={root}>
      <div className="ob-inner">
        <div className="ob-dots" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i === step ? "on" : undefined} />)}</div>
        {step === 0 && (
          <>
            <div className="ob-hero"><img src="./icon.svg" alt="" width={96} height={96} /><span className="ob-wm">Pantry Prep</span></div>
            <h1 id="ob-h" ref={heading} tabIndex={-1}>Be ready for three days</h1>
            <p>If shops, power or water stop for a few days, would your home have enough to eat and drink? Pantry Prep helps you build a store that lasts, following the UK Government's <b>Be Ready</b> advice.</p>
            <ul className="ob-points"><li>See how many days your food and water last</li><li>Get a shopping list that fills the gaps</li><li>Find meals you can make without power, and print recipe cards</li></ul>
            <p className="small muted">Everything stays on this phone. No account, no sign-up.</p>
            <button className="btn primary block" onClick={() => setStep(1)}>Get started</button>
          </>
        )}
        {step === 1 && (
          <>
            <p className="ob-step">Step 1 of 2</p>
            <h1 id="ob-h" ref={heading} tabIndex={-1}>Who lives with you?</h1>
            <p className="muted">We use this to work out how much food and water you need.</p>
            <div className="ob-need" aria-live="polite">
              <div><span className="v num"><CountUp value={tg.water} format={(n) => fmt(n)} /> L</span><span className="k">water</span></div>
              <div><span className="v num"><CountUp value={tg.kcal} format={(n) => fmt(n)} /></span><span className="k">kcal of food</span></div>
              <p className="k">What your home needs for {h.days} days</p>
            </div>
            <div className="card">
              {HOUSE.map(([k, label, sub]) => (
                <div className="set-row" key={k}>
                  <div className="row-main"><span className="t">{label}</span><span className="s">{sub}</span></div>
                  <Stepper value={h[k]} less={`Fewer ${label.toLowerCase()}`} more={`More ${label.toLowerCase()}`}
                    onStep={(d) => update((s) => {
                      s.house[k] = Math.min(20, Math.max(0, s.house[k] + d));
                      if (s.house.adults + s.house.children === 0) s.house.adults = 1;
                    })} />
                </div>
              ))}
            </div>
            <div className="card">
              <div className="row-main"><span className="t">How many days to cover?</span><span className="s">The government advises at least 3 days.</span></div>
              <div className="chips" role="radiogroup" aria-label="Days to cover">
                {[3, 7, 14].map((d) => <button type="button" key={d} className="chip" role="radio" aria-checked={h.days === d} onClick={() => update((s) => { s.house.days = d; })}>{d} days</button>)}
              </div>
            </div>
            <button className="btn primary block" onClick={() => setStep(2)}>Continue</button>
            <button className="btn block" onClick={() => setStep(0)}>Back</button>
          </>
        )}
        {step === 2 && (
          <>
            <p className="ob-step">Step 2 of 2</p>
            <h1 id="ob-h" ref={heading} tabIndex={-1}>Any allergies or diets?</h1>
            <p className="muted">We'll hide recipes that may not suit you. This stays on your phone. Always check labels, as brands differ.</p>
            <div className="card"><AllergyPicker state={state} onChange={update} /></div>
            <button className="btn primary block" onClick={() => finish(false)}>Start my store</button>
            <button className="btn block" onClick={() => finish(true)}>Look around an example store first</button>
            <button className="btn block ghost" onClick={() => setStep(1)}>Back</button>
          </>
        )}
      </div>
    </div>
  );
}
