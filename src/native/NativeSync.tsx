import { useEffect } from "react";
import { useApp } from "../ui/appState";
import { isNativeApp } from "./platform";

/** In the iPhone app, keeps the backup copy and reminders in step with the store. Renders nothing. */
export function NativeSync() {
  const { state } = useApp();
  useEffect(() => {
    if (!isNativeApp()) return;
    const t = setTimeout(() => { import("./bridge").then((b) => b.syncStore(state)); }, 600);
    return () => clearTimeout(t);
  }, [state]);
  return null;
}
