// App Store screenshots for the 6.9-inch iPhone size (1320 x 2868), with a headline on each.
// Run after `npm run build`:  npx vite preview --port 4173 &  node scripts/store-screenshots.cjs out-dir
// Needs Playwright with Chromium (installed for the e2e tests).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const out = path.resolve(process.argv[2] || "store-screenshots");
const base = process.env.APP_URL || "http://localhost:4173/";
const font = path.resolve(__dirname, "../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2");

const SHOTS = [
  { file: "1-days-covered", title: "Know how many days your food lasts", go: null },
  { file: "2-add-food", title: "Add food in seconds", go: "add" },
  { file: "3-store", title: "Every tin, pack and bottle in one place", go: "Store" },
  { file: "4-recipes", title: "Meals you can make without power", go: "Recipes" },
  { file: "5-print", title: "Plan your kit and print cards for the cupboard", go: "Prepare" },
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const app = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: "light", reducedMotion: "reduce" });
  const pg = await app.newPage();
  await pg.goto(base);
  await pg.getByRole("button", { name: "Get started" }).click();
  await pg.getByRole("button", { name: "Continue" }).click();
  await pg.getByRole("button", { name: "Look around an example store first" }).click();
  // Use the example food as if it were the person's own, with one item nearing its best-before date.
  await pg.evaluate(() => {
    const k = "pantry-prep-v1";
    const s = JSON.parse(localStorage.getItem(k));
    s.example = false;
    const d = new Date(); d.setDate(d.getDate() + 20);
    if (s.items[1]) s.items[1].bb = d.toISOString().slice(0, 10);
    localStorage.setItem(k, JSON.stringify(s));
  });
  const raws = [];
  for (const shot of SHOTS) {
    await pg.reload();
    await pg.waitForTimeout(1000);
    if (shot.go === "add") {
      await pg.getByRole("button", { name: /^Add/ }).first().click();
    } else if (shot.go) {
      await pg.getByRole("navigation", { name: "Main" }).getByRole("button", { name: shot.go }).click();
    }
    await pg.waitForTimeout(600);
    const raw = path.join(out, `raw-${shot.file}.png`);
    await pg.screenshot({ path: raw });
    raws.push({ ...shot, raw });
  }

  const frame = await browser.newPage({ viewport: { width: 1320, height: 2868 }, deviceScaleFactor: 1 });
  const fontUrl = "data:font/woff2;base64," + fs.readFileSync(font).toString("base64");
  for (const s of raws) {
    const img = "data:image/png;base64," + fs.readFileSync(s.raw).toString("base64");
    await frame.setContent(`<style>
      @font-face { font-family: B; src: url(${fontUrl}) format("woff2"); font-weight: 200 800; }
      * { margin: 0; box-sizing: border-box; }
      body { width: 1320px; height: 2868px; overflow: hidden; background: radial-gradient(120% 60% at 50% 0%, #1d4d41, #12382f 70%); font-family: B, system-ui, sans-serif; color: #fff; }
      h1 { padding: 170px 110px 0; font-size: 104px; line-height: 1.04; font-weight: 750; letter-spacing: -0.035em; text-align: center; text-wrap: balance; }
      h1::after { content: ""; display: block; width: 120px; height: 14px; border-radius: 7px; background: #f0a83a; margin: 56px auto 0; }
      .phone { position: absolute; left: 50%; bottom: -120px; transform: translateX(-50%); width: 1040px; height: 2260px; border-radius: 120px; background: #0b1512; padding: 26px; box-shadow: 0 40px 120px rgba(0,0,0,.45); }
      .phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; border-radius: 96px; display: block; }
    </style><h1>${s.title}</h1><div class="phone"><img src="${img}"></div>`);
    await frame.waitForTimeout(150);
    await frame.screenshot({ path: path.join(out, `${s.file}.png`) });
    fs.unlinkSync(s.raw);
  }
  await browser.close();
  console.log("Saved to", out);
})().catch((e) => { console.error(e); process.exit(1); });
