import { expect, type Page } from "@playwright/test";

/** Finish the welcome screens. */
export async function onboard(page: Page, { example = false } = {}) {
  await page.goto("./");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: example ? "Look around an example store first" : "Start my store" }).click();
  await expect(page.locator(".onboard")).toHaveCount(0);
}

export async function tab(page: Page, name: "Dashboard" | "Store" | "Recipes" | "Prepare") {
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name }).click();
}

export const OFF_BEANS = {
  status: 1,
  product: {
    product_name: "Baked Beans in Tomato Sauce", brands: "Heinz", quantity: "415 g", product_quantity: 415,
    categories_tags: ["en:baked-beans"], nutriments: { "energy-kcal_100g": 78, proteins_100g: 4.7, fiber_100g: 3.7 },
  },
};

export const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };

/** A tiny real PNG, enough for the app to shrink and send. */
export const PHOTO = "e2e/fixtures/shelf.png";

export const SCAN_REPLY = {
  food: [
    { id: "tuna", name: "Tuna chunks in spring water", pack: "145 g tin", count: 3, kind: "fish", group: "protein", kcal: 110, protein: 25, fibre: 0, litres: 0, portions: 1, bb: "2028-03-31", confidence: "high" },
    { id: "", name: "Mystery tin", pack: "400 g tin", count: 1, kind: "", group: "other", kcal: 200, protein: 5, fibre: 2, litres: 0, portions: 0, bb: "", confidence: "low" },
    { id: "", name: "Oat biscuits", pack: "300 g pack", count: 2, kind: "", group: "starchy", kcal: 1400, protein: 25, fibre: 20, litres: 0, portions: 6, bb: "", confidence: "medium" },
  ],
  kit: ["torch"],
};
