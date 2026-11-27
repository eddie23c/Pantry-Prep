// Tester tools for choosing the scan model: side-by-side results from one photo, a vote for
// the most accurate list, and the running tally. Shown only to people with the tester code.
import { useState } from "react";
import { getTally, getTesterCode, modelLabel, pence, setTesterCode, ScanError, type CompareRun, type Tally } from "../scan";
import { normalise } from "../scanResult";
import { plural } from "./common";

const total = (r: CompareRun) => normalise({ food: r.food || [] }).reduce((t, i) => t + i.count, 0);

export function CompareResults({ results, onPick }: { results: CompareRun[]; onPick: (model: string) => void }) {
  return (
    <div className="compare" aria-label="Results from each model">
      <p className="small muted">Count what is really in your photo, then pick the list that got closest. Your pick is added to the tally on the Prepare tab.</p>
      {results.map((r) => {
        const items = normalise({ food: r.food || [] });
        return (
          <section className="card compare-card" key={r.model} aria-label={modelLabel(r.model)}>
            <div className="card-head">
              <h3>{modelLabel(r.model)}</h3>
              <span className="small muted num">
                {r.ok ? `${plural(total(r), "item", "items")} · ` : ""}
                {r.seconds ? `${Math.round(r.seconds)} s` : ""}
                {typeof r.usd === "number" ? ` · ≈${pence(r.usd)}` : ""}
              </span>
            </div>
            {r.ok ? (
              items.length ? (
                <ul className="compare-list">
                  {items.map((i, n) => (
                    <li key={n}><span className="num">{i.count} ×</span> {i.name}{i.pack ? <span className="muted"> · {i.pack}</span> : null}{i.conf === "low" ? <span className="conf low">unsure</span> : null}</li>
                  ))}
                </ul>
              ) : <p className="small muted">Found nothing.</p>
            ) : <p className="small muted">{r.error === "refused" ? "This model declined the photo." : "This model did not answer."}</p>}
            {r.ok && items.length > 0 && <button className="btn primary block" onClick={() => onPick(r.model)}>{modelLabel(r.model)} was most accurate</button>}
          </section>
        );
      })}
      <button className="btn block" onClick={() => onPick("none")}>None of them were right</button>
    </div>
  );
}

export function TesterCard() {
  const [code, setCode] = useState(getTesterCode);
  const [tally, setTally] = useState<Tally | null>(null);
  const [status, setStatus] = useState("");
  const load = async () => {
    setStatus("Loading…");
    try {
      setTally(await getTally());
      setStatus("");
    } catch (err) {
      setStatus(err instanceof ScanError && err.code === "bad_tester" ? "That tester code is not right." : err instanceof ScanError && err.code === "compare_off" ? "Model comparison is not turned on in the scanner yet." : "Could not load the results. Check your connection.");
    }
  };
  return (
    <details className="tester">
      <summary className="small">Testing: compare scan models</summary>
      <p className="small muted">For testers. Runs one photo through several Claude models side by side so you can pick the most accurate. Each compare costs a few pence.</p>
      {code ? (
        <>
          <div className="set-row">
            <div className="row-main"><span className="t">Compare scans on</span><span className="s">Tick “Compare models” on the Photo tab</span></div>
            <button className="btn danger" onClick={() => { setTesterCode(""); setCode(""); setTally(null); }}>Turn off</button>
          </div>
          <button className="btn block" onClick={load}>Show results so far</button>
          {tally && (
            <div className="tally">
              <p className="small muted">{plural(tally.compares, "compare", "compares")}, {plural(tally.votes, "pick", "picks")}{tally.none ? `, ${tally.none} where none were right` : ""}.</p>
              <table>
                <thead><tr><th scope="col">Model</th><th scope="col">Most accurate</th><th scope="col">Items found</th><th scope="col">Time</th><th scope="col">Cost</th></tr></thead>
                <tbody>
                  {tally.models.map((m) => (
                    <tr key={m.model}>
                      <th scope="row">{modelLabel(m.model)}</th>
                      <td className="num">{m.wins}</td>
                      <td className="num">{m.runs ? m.avgItems.toFixed(1) : "–"}</td>
                      <td className="num">{m.runs ? `${Math.round(m.avgSeconds)} s` : "–"}</td>
                      <td className="num">{m.runs ? pence(m.avgUsd) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="small muted">Items, time and cost are averages per photo. Cost is approximate, in pence.</p>
            </div>
          )}
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); const v = (new FormData(e.currentTarget).get("tester") as string || "").trim(); if (v) { setTesterCode(v); setCode(v); } }}>
          <label className="search" htmlFor="tester-code"><input id="tester-code" name="tester" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Tester code" aria-label="Tester code" /></label>
          <button className="btn block" type="submit">Turn on compare scans</button>
        </form>
      )}
      <p className="status" aria-live="polite">{status}</p>
    </details>
  );
}
