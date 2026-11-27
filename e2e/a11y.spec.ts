import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CORS, onboard, PHOTO, SCAN_REPLY, tab } from "./helpers";

// Automated WCAG 2.2 A and AA checks on every screen and sheet.
async function check(page: Page) {
  await page.waitForTimeout(350); // let sheet and ring animations finish
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = r.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n  ")}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("welcome screens", async ({ page }) => {
      await page.goto("./");
      await check(page);
      await page.getByRole("button", { name: "Get started" }).click();
      await check(page);
      await page.getByRole("button", { name: "Continue" }).click();
      await check(page);
    });

    test("every tab", async ({ page }) => {
      await onboard(page, { example: true });
      for (const t of ["Dashboard", "Store", "Recipes", "Prepare"] as const) {
        await tab(page, t);
        await check(page);
      }
    });

    test("sheets", async ({ page }) => {
      await onboard(page, { example: true });
      await page.route("https://scan.test/scan", (r) =>
        r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ headers: CORS, json: { ...SCAN_REPLY, remaining: 9 } }));
      await page.getByRole("button", { name: "Add food" }).click();
      await check(page);
      await page.locator("#photo-input").setInputFiles(PHOTO);
      await page.getByRole("button", { name: "Find food in 1 photo" }).click();
      await expect(page.getByText("Found 3 products")).toBeVisible();
      await check(page);
      await page.getByRole("tab", { name: "Search" }).click();
      await check(page);
      await page.getByRole("tab", { name: "Barcode" }).click();
      await check(page);
      await page.getByRole("button", { name: "Close" }).click();
      await tab(page, "Store");
      await page.locator("#screen-store [data-item]", { hasText: "Baked beans" }).click();
      await check(page);
      await page.getByRole("button", { name: "Close" }).click();
      await tab(page, "Recipes");
      await page.locator("#screen-recipes .rcard").first().click();
      await check(page);
      await page.getByRole("button", { name: "Close" }).click();
      await page.goto("./#privacy");
      await check(page);
    });
  });
}
