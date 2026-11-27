import "@fontsource-variable/bricolage-grotesque";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { AppProvider } from "./ui/appState";
import { NativeSync } from "./native/NativeSync";
import { isNativeApp } from "./native/platform";

// In the iPhone app, put back the app's own copy of the store first if the web view lost it.
const native = isNativeApp();
const bridge = native ? import("./native/bridge") : null;
(bridge ? bridge.then((b) => b.restoreStore()) : Promise.resolve()).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppProvider>
        <App />
        <NativeSync />
      </AppProvider>
    </StrictMode>,
  );
  bridge?.then((b) => b.appReady());
});

// Fade the launch screen once the app has drawn, keeping it up at least briefly so it never flickers.
const splash = document.getElementById("splash");
if (splash) {
  const wait = Math.max(0, 450 - performance.now());
  setTimeout(() => requestAnimationFrame(() => {
    splash.classList.add("gone");
    splash.addEventListener("transitionend", () => splash.remove(), { once: true });
    setTimeout(() => splash.remove(), 800);
  }), wait);
}

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); });
}
