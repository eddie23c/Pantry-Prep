import { expect, test } from "@playwright/test";
import { OFF_BEANS, onboard, tab } from "./helpers";

test("first visit: welcome screens, then an empty store", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Be ready for three days" })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "More adults" }).click();
  await page.getByRole("radio", { name: "7 days" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start my store" }).click();
  await expect(page.getByRole("heading", { name: "Food store" })).toBeVisible();
  await expect(page.locator("#house-label")).toHaveText("4 people · 7 days");
  await page.reload();
  await expect(page.locator(".onboard")).toHaveCount(0);
});

test("add food from the list and see days covered rise", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Add food" }).click();
  await page.getByPlaceholder("Search tins, packets, water…").fill("water");
  await page.getByRole("button", { name: "Add one Bottled water" }).first().click();
  await page.getByRole("button", { name: "Close" }).click();
  await tab(page, "Store");
  await expect(page.locator("#screen-store [data-item]", { hasText: "Bottled water" })).toBeVisible();
});

test("barcode: type a number, confirm the product, add it", async ({ page }) => {
  await page.route("https://world.openfoodfacts.org/**", (r) =>
    r.fulfill({ json: OFF_BEANS, headers: { "access-control-allow-origin": "*" } }));
  await onboard(page);
  await page.getByRole("button", { name: "Add food" }).click();
  await page.getByRole("tab", { name: "Barcode" }).click();
  await page.getByLabel("Or type the number under the barcode").fill("5000157024886");
  await page.getByRole("button", { name: "Look it up" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Heinz Baked Beans in Tomato Sauce");
  await expect(page.getByLabel("kcal per pack")).toHaveValue("324");
  await page.getByRole("button", { name: "One more" }).click();
  await page.getByRole("button", { name: "Add 2 to store" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await tab(page, "Store");
  await expect(page.locator("#screen-store [data-item]", { hasText: "Heinz Baked Beans" })).toBeVisible();
});

test("barcode: a mistyped number is caught before lookup", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Add food" }).click();
  await page.getByRole("tab", { name: "Barcode" }).click();
  await page.getByLabel("Or type the number under the barcode").fill("5000157024887");
  await page.getByRole("button", { name: "Look it up" }).click();
  await expect(page.getByText("That number doesn't look right")).toBeVisible();
});

test("best-before date shows on the dashboard when it is close", async ({ page }) => {
  await onboard(page, { example: true });
  await tab(page, "Store");
  await page.locator("#screen-store [data-item]", { hasText: "Baked beans" }).click();
  const soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Best-before date").fill(soon);
  await page.getByRole("button", { name: "Close" }).click();
  await tab(page, "Dashboard");
  await expect(page.getByRole("heading", { name: "Eat and replace" })).toBeVisible();
});

test("allergies hide recipes that may contain them", async ({ page }) => {
  await onboard(page, { example: true });
  await tab(page, "Prepare");
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("button", { name: "Fish" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await tab(page, "Recipes");
  await expect(page.getByText(/hidden because of your allergies/)).toBeVisible();
  await expect(page.locator("#screen-recipes").getByText("Tuna and sweetcorn crackers")).toHaveCount(0);
});

test("kit check date is saved", async ({ page }) => {
  await onboard(page);
  await tab(page, "Prepare");
  await page.getByRole("button", { name: "I checked it today" }).click();
  await expect(page.locator(".kit-check")).toContainText("Last checked");
});

test("privacy, terms and accessibility open from the Prepare tab and by link", async ({ page }) => {
  await onboard(page);
  await tab(page, "Prepare");
  await page.getByRole("link", { name: /Privacy/ }).click();
  await expect(page.getByRole("dialog", { name: "Privacy" })).toContainText("Your store stays on your phone");
  await page.getByRole("button", { name: "Close" }).click();
  await page.goto("./#terms");
  await expect(page.getByRole("dialog", { name: "Terms and disclaimer" })).toBeVisible();
});

test("printable cards open with a stock list and QR code", async ({ page, context }) => {
  await onboard(page, { example: true });
  await tab(page, "Prepare");
  const [popup] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Download cards to print" }).click()]);
  await expect(popup.getByRole("heading", { name: "Our emergency store" })).toBeVisible();
  await expect(popup.getByRole("img", { name: /QR code/ })).toBeVisible();
});

test("photo scan asks for an API key, and the key can be saved and removed", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Add food" }).click();
  await page.getByRole("tab", { name: "Scan a photo" }).click();
  await page.getByRole("button", { name: "Add API key" }).click();
  await expect(page.getByLabel("Anthropic API key")).toBeFocused();
  await page.getByLabel("Anthropic API key").fill("not-a-key");
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByText("doesn't look like an Anthropic API key")).toBeVisible();
  await page.getByLabel("Anthropic API key").fill("sk-ant-" + "x".repeat(30));
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.locator("#key-card")).toContainText("Key saved");
  await page.getByRole("button", { name: "Add food" }).click();
  await page.getByRole("tab", { name: "Scan a photo" }).click();
  await expect(page.getByText("Photograph your shelves and kit")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.locator("#key-card").getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("#key-card")).toContainText("Off");
});

test("clear the example store, then back up and restore", async ({ page }) => {
  await onboard(page, { example: true });
  await tab(page, "Prepare");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save a backup file" }).click()]);
  const file = await download.path();
  await tab(page, "Store");
  await page.getByRole("button", { name: "Clear example" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator("#screen-store [data-item]")).toHaveCount(0);
  await tab(page, "Prepare");
  await page.locator("#restore-input").setInputFiles(file);
  await expect(page.getByRole("status")).toHaveText("Store restored from backup");
  await tab(page, "Store");
  await expect(page.locator("#screen-store [data-item]").first()).toBeVisible();
});

test("tick a kit item by hand and it survives a reload", async ({ page }) => {
  await onboard(page);
  await tab(page, "Prepare");
  await page.getByLabel("Torch (battery or wind-up)").check();
  await page.reload();
  await expect(page.getByLabel("Torch (battery or wind-up)")).toBeChecked();
});
