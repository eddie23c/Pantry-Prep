// App state for the React screens: the saved store (on the phone), which tab and sheet are open,
// and toasts. Every change to the saved store goes through `update`, which saves it.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppState } from "../calc";
import { defaultState, load, save } from "../storage";

export type Screen = "home" | "store" | "recipes" | "prepare";
export type AddMode = "search" | "barcode" | "scan";
export type SheetState =
  | { kind: "add"; group?: string; mode?: AddMode }
  | { kind: "recipe"; id: string }
  | { kind: "item"; id: string }
  | { kind: "about" }
  | { kind: "diet" }
  | { kind: "legal"; page: string };

interface Ctx {
  state: AppState;
  /** Change the saved store. The function edits a copy, which is then saved. */
  update: (fn: (s: AppState) => void) => void;
  replace: (s: AppState) => void;
  screen: Screen;
  go: (s: Screen) => void;
  sheet: SheetState | null;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
  toast: (msg: string) => void;
  toastMsg: string;
}

const AppContext = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppContext);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

function initialScreen(): Screen {
  try {
    const s = sessionStorage.getItem("pp-screen");
    if (s === "home" || s === "store" || s === "recipes" || s === "prepare") return s;
  } catch { /* storage blocked */ }
  return "home";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => load() || defaultState());
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(0);

  const update = useCallback((fn: (s: AppState) => void) => {
    setState((prev) => {
      const next = structuredClone(prev);
      fn(next);
      save(next);
      return next;
    });
  }, []);
  const replace = useCallback((s: AppState) => { save(s); setState(s); }, []);
  const go = useCallback((s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
    try { sessionStorage.setItem("pp-screen", s); } catch { /* storage blocked */ }
  }, []);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(""), 2200);
  }, []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const value = useMemo(
    () => ({ state, update, replace, screen, go, sheet, openSheet: setSheet, closeSheet, toast, toastMsg }),
    [state, update, replace, screen, go, sheet, closeSheet, toast, toastMsg],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
