import { useEffect, type ReactElement } from "react";
import { LEGAL } from "../legal";
import { people } from "../calc";
import { AddSheet } from "./AddSheet";
import { plural } from "./common";
import { Home } from "./Home";
import { Onboarding } from "./Onboarding";
import { Prepare } from "./Prepare";
import { Recipes } from "./Recipes";
import { AboutSheet, DietSheet, ItemSheet, LegalSheet, RecipeSheet } from "./Sheets";
import { Store } from "./Store";
import { useApp, type Screen } from "./appState";

const TITLES: Record<Screen, string> = { home: "Your store", store: "Food store", recipes: "Recipes", prepare: "Be prepared" };

function TopBar() {
  const { state, screen, go } = useApp();
  const h = state.house;
  return (
    <header className="topbar">
      <div className="brand-row">
        <img className="brand-tile" src="./icon.svg" alt="" width={38} height={38} />
        <div>
        <div className="sub" id="top-sub">{screen === "home" ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "Pantry Prep"}</div>
        <h1 id="top-title">{TITLES[screen]}</h1>
        </div>
      </div>
      <button className="pill-btn" id="house-btn" onClick={() => go("prepare")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
        <span id="house-label">{plural(people(h), "person", "people")} · {plural(h.days, "day", "days")}</span>
        <span className="sr-only">, edit household</span>
      </button>
    </header>
  );
}

const ICONS: Record<Screen, ReactElement> = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  store: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="3.5" width="16" height="17" rx="2" /><path d="M4 9.5h16M4 15h16" /></svg>,
  recipes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16a8 8 0 0 1-16 0z" /><path d="M9 4c0 2 2 2 2 4M14 4c0 2 2 2 2 4" /></svg>,
  prepare: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
};

function TabBar({ inert }: { inert: boolean }) {
  const { screen, go, openSheet } = useApp();
  const tab = (s: Screen, label: string) => (
    <button className="tab" data-go={s} aria-current={screen === s ? "page" : undefined} onClick={() => go(s)}>{ICONS[s]}{label}</button>
  );
  return (
    <nav className="tabbar" aria-label="Main" inert={inert}>
      <div className="tabbar-inner">
        {tab("home", "Dashboard")}
        {tab("store", "Store")}
        <button className="fab" id="fab" aria-label="Add food" onClick={() => openSheet({ kind: "add" })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        {tab("recipes", "Recipes")}
        {tab("prepare", "Prepare")}
      </div>
    </nav>
  );
}

function CurrentSheet() {
  const { sheet } = useApp();
  if (!sheet) return null;
  switch (sheet.kind) {
    case "add": return <AddSheet group={sheet.group} mode={sheet.mode} />;
    case "recipe": return <RecipeSheet id={sheet.id} />;
    case "item": return <ItemSheet id={sheet.id} />;
    case "about": return <AboutSheet />;
    case "diet": return <DietSheet />;
    case "legal": return <LegalSheet page={sheet.page} />;
  }
}

export function App() {
  const { state, screen, sheet, openSheet, toastMsg } = useApp();

  // #privacy, #terms and #accessibility open those pages, so they can be linked from anywhere.
  useEffect(() => {
    const route = () => {
      const page = location.hash.slice(1);
      if (page in LEGAL) { openSheet({ kind: "legal", page }); history.replaceState(null, "", location.pathname + location.search); }
    };
    if (state.onboarded) route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, [openSheet, state.onboarded]);

  const behind = !!sheet || !state.onboarded;
  const screens: [Screen, ReactElement][] = [["home", <Home />], ["store", <Store />], ["recipes", <Recipes />], ["prepare", <Prepare />]];
  return (
    <>
      <div className="app" inert={behind}>
        <TopBar />
        {screens.map(([id, el]) => (
          <section className="screen" id={`screen-${id}`} key={id} hidden={screen !== id}>{screen === id && el}</section>
        ))}
      </div>
      <TabBar inert={behind} />
      <CurrentSheet />
      {!state.onboarded && <Onboarding />}
      <div className="toast" role="status" hidden={!toastMsg}>{toastMsg}</div>
    </>
  );
}
