# Pantry Prep

Pantry Prep helps UK households build and check a 3-day emergency food and water store, as the UK Government's [Be Ready](https://beready.campaign.gov.uk/be-ready-for-emergencies/) campaign advises.

- **Dashboard:** how many days your food and water last, plus water, protein, fibre and Eatwell food-group progress.
- **Store:** a food diary of what you hold, with quick add from a list of common store-cupboard foods.
- **Top up:** a shopping list that closes every gap.
- **Recipes:** no-cook and camping-stove meals ranked by what you already hold.
- **Print cards:** an A4 page of recipe cards and a dated stock list to keep with the food.
- **Be Ready kit:** the official checklist, ticked automatically where the store covers it.

## Privacy

Everything stays on the phone (browser storage). There are no accounts and nothing is sent to a server. People can save a backup file and restore it on another device.

## Run it locally

Needs Node 20 or newer.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the calculations
npm run typecheck
npm run build      # production build in dist/
```

## Hosting

Every push to `main` builds and deploys to GitHub Pages (free) through `.github/workflows/deploy.yml`. One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The app is then at `https://eddie23c.github.io/pantry-prep/`.

It installs to the home screen and works offline after the first visit.

## Code layout

| File | What it holds |
| --- | --- |
| `src/data.ts` | Food catalogue, recipes, Be Ready kit list, guidance links |
| `src/calc.ts` | Targets, totals, days covered, shopping list, recipe matching (tested) |
| `src/storage.ts` | On-device storage, backup and restore (tested) |
| `src/main.ts` | Screens and interactions, ported from the prototype |
| `public/sw.js` | Offline support |

## Sources and accuracy

Water uses the UK Government figure of 3 litres per person per day for drinking. Food targets (2,000 kcal, 50 g protein and 30 g fibre per adult per day) are approximate UK reference intakes and still need review. Nutrition per pack is a typical label figure. Pantry Prep gives general guidance, not medical or dietary advice.
