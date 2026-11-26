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
