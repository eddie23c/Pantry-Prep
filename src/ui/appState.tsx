// App state for the React screens: the saved store (on the phone), which tab and sheet are open,
// and toasts. Every change to the saved store goes through `update`, which saves it.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppState } from "../calc";
import { defaultState, load, save } from "../storage";
import { haptic } from "./feel";

export type Screen = "home" | "store" | "recipes" | "prepare";
export type AddMode = "search" | "barcode" | "scan";
export type SheetState =
  | { kind: "add"; group?: string; mode?: AddMode }
  | { kind: "recipe"; id: string }
  | { kind: "item"; id: string }
  | { kind: "about" }
  | { kind: "diet" }
  | { kind: "feedback" }
  | { kind: "legal"; page: string };

export interface ToastAction { label: string; run: () => void }

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
  /** Show a short message. With an action, a button (such as Undo) shows beside it for a little longer. */
  toast: (msg: string, action?: ToastAction) => void;
  toastMsg: string;
  toastAction: ToastAction | null;
  dismissToast: () => void;
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
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
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
  const dismissToast = useCallback(() => { clearTimeout(toastTimer.current); setToastMsg(""); setToastAction(null); }, []);
  const toast = useCallback((msg: string, action?: ToastAction) => {
    setToastMsg(msg);
    setToastAction(action || null);
    haptic();
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => { setToastMsg(""); setToastAction(null); }, action ? 6000 : 2200);
  }, []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const value = useMemo(
    () => ({ state, update, replace, screen, go, sheet, openSheet: setSheet, closeSheet, toast, toastMsg, toastAction, dismissToast }),
    [state, update, replace, screen, go, sheet, closeSheet, toast, toastMsg, toastAction, dismissToast],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
