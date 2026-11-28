# Pantry Prep

Pantry Prep helps UK households build and check a 3-day emergency food and water store, as the UK Government's [Be Ready](https://beready.campaign.gov.uk/be-ready-for-emergencies/) campaign advises.

- **Photo scan (the main way to add food):** take one photo of a pile of food or a shelf, Claude lists every item, you fix counts and add. Search and barcodes are there for odd items.
- **Dashboard:** how many days your food and water last, plus water, protein, fibre and Eatwell food-group progress.
- **Store:** a food diary of what you hold, with quick add from a list of common store-cupboard foods.
- **Top up:** a shopping list that closes every gap.
- **Recipes:** no-cook and camping-stove meals ranked by what you already hold.
- **Print cards:** an A4 page of recipe cards and a dated stock list to keep with the food.
- **Be Ready kit:** the official checklist, ticked automatically where the store covers it.

## Privacy

Everything stays on the phone (browser storage). There are no accounts, and no server ever receives your store. Photo scans go through a small scan worker (below) to Anthropic and are not kept. Barcode scans send only the barcode number to Open Food Facts. The full privacy notice is in the app (`#privacy`). People can save a backup file and restore it on another device.

## Run it locally

Needs Node 20 or newer.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (calculations, dates, barcodes, allergens, print file)
npm run e2e        # end-to-end and accessibility tests in a phone-sized browser
npm run typecheck
npx tsc -p worker   # type-check the scan worker
npm run build      # production build in dist/
```

## Hosting

Every push to `main` builds and deploys to GitHub Pages (free) through `.github/workflows/deploy.yml`. One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The app is then at `https://eddie23c.github.io/Pantry-Prep/`.

It installs to the home screen and works offline after the first visit.

## Photo scanning

The app sends shrunk photos (1,400 px, about 300 KB each, up to 3 per scan) to a tiny Cloudflare Worker in `worker/`. The worker holds the Anthropic key, checks the daily limits and asks Claude Haiku 5.5 to list the food. Nobody using the app needs a key. People can still add their own Anthropic key on the Prepare tab for unlimited scans.

**Video scans.** People can instead film a 10 to 20 second video moving around the pile. The phone picks up to 6 sharp stills spread across the video (`src/frames.ts`, 1,280 px each) and only those are sent, never the video. Claude is told they are frames of one pile, so each tin is counted once. A video scan uses one photo of the daily allowance per two stills (`VIDEO_FRAMES` in `worker/wrangler.toml`), so at most 3. Estimated cost with Haiku 5.5 is about two photos' worth (roughly 0.3p), since output tokens are about the same and the stills are smaller than photos.

**Best-before dates from a scan.** Each product says how many packs Claude read the date on. In the review list every date is marked: **read** (on every pack), **partly read** (read on 1 of 4, used for the rest), **matched** (not visible, copied from an identical product in the same scan, the earliest if several) or **estimate** (none seen, typical shelf life from `SHELF_MONTHS`). Partly read and matched dates are saved with a note on the item so people know to check the packs.

**Limits** (in `worker/wrangler.toml`, counted in photos, reset at midnight UTC): 12 per phone, 36 per internet address, 300 for everyone together. An optional invite code keeps strangers out.

**Cost:** about $0.002 (0.15p) per photo with Haiku 5.5, so 1,000 photos is roughly £1.50. The 300-a-day total cap means the most it can ever spend is about 60p a day. Cloudflare's free plan covers the worker. Set a monthly spend limit in the Anthropic console as a backstop.

**Choosing the model (accuracy first).** Testers can compare models on real photos before the beta settles on one:

- Add a repository secret `SCAN_TESTER_CODE` and re-run **Deploy scan worker**. In the app, **Prepare → Photo scanning → Testing: compare scan models**, enter that code.
- On the Photo tab, tick **Compare models on this photo**. One photo goes to Haiku 5.5, Sonnet 5.5 and Opus 5.5 at once (`COMPARE_MODELS` in `worker/wrangler.toml`). Each list shows items found, time and cost. Count what is really in the photo and pick the list that got closest; the pick adds that list to your store and to the tally.
- **Show results so far** gives wins, average items found, time and cost per model, across every tester.
- Rough cost per photo (about 3,300 tokens in, 3,000 out): Haiku 5.5 0.15p, Sonnet 5.5 3p, Opus 5.5 6p. A compare runs all three, about 9p. Limits: 20 compares a day per phone, 40 in total (`TESTER_DAILY_COMPARES`, `TOTAL_DAILY_COMPARES`).
- **To switch the everyday model**, add a repository variable `SCAN_MODEL` (for example `claude-sonnet-5-5`) under **Settings → Secrets and variables → Actions → Variables**, then re-run **Deploy scan worker**. Delete the variable to go back to Haiku.

**One-time setup:**

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com), open **Workers & Pages** once so it gives you a `workers.dev` address, and copy your **Account ID** from that page.
2. In Cloudflare, **My Profile → API Tokens → Create Token → Edit Cloudflare Workers** template. Copy the token.
3. In the [Anthropic console](https://console.anthropic.com), add $5 of credit, set a monthly limit (say $10), and create an API key.
4. In this repository, **Settings → Secrets and variables → Actions → New repository secret**, add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, and optionally `SCAN_ACCESS_CODE` (invite code for friends) and `SCAN_TESTER_CODE` (turns on model comparison).
5. **Actions → Deploy scan worker → Run workflow**. The run summary shows the worker's address.
6. Under **Settings → Secrets and variables → Actions → Variables**, add `SCAN_URL` with that address, then run **Deploy to GitHub Pages** again.

Each scan's token counts are logged in Cloudflare (**Workers → pantry-prep-scan → Logs**), so the real cost per scan can be checked there and in the Anthropic console.

## Code layout

| File | What it holds |
| --- | --- |
| `src/data.ts` | Food catalogue, recipes, Be Ready kit list, guidance links |
| `src/calc.ts` | Targets, totals, days covered, shopping list, recipe matching (tested) |
| `src/storage.ts` | On-device storage, backup and restore (tested) |
| `src/main.tsx`, `src/ui/` | React screens and sheets. `appState.tsx` holds the saved store, open tab and sheet |
| `src/dates.ts` | Best-before dates and kit check reminders (tested) |
| `src/barcode.ts`, `src/off.ts` | Barcode scanning and the Open Food Facts lookup (mapping tested) |
| `src/allergens.ts` | The 14 UK allergens, diets and recipe filtering (tested) |
| `src/print.ts` | The printable A4 store list and recipe cards (tested) |
| `src/scan.ts`, `src/scanPrompt.ts`, `src/scanResult.ts` | Photo scanning (through the worker or an own key), the shared prompt, and turning replies into store items, including filling in dates across matching packs (tested) |
| `src/frames.ts` | Picking sharp stills from a short video on the phone for video scans (tested) |
| `worker/` | The scan worker on Cloudflare: key, daily limits, Claude call (rules tested) |
| `src/legal.ts` | Privacy notice, terms and accessibility statement |
| `e2e/` | Playwright end-to-end tests and axe accessibility checks |
| `public/sw.js` | Offline support |

## Sources and accuracy

Water uses the UK Government figure of 3 litres per person per day for drinking. Food targets (2,000 kcal, 50 g protein and 30 g fibre per adult per day) are approximate UK reference intakes and still need review. Nutrition per pack is a typical label figure. Pantry Prep gives general guidance, not medical or dietary advice.

## iPhone app

The same app is wrapped with Capacitor for the App Store, with native printing, sharing, reminders and haptics. It builds on GitHub's free macOS machines, so no Mac is needed. See [docs/app-store/README.md](docs/app-store/README.md).
