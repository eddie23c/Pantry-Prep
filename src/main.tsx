import "@fontsource-variable/bricolage-grotesque";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { AppProvider } from "./ui/appState";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

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
