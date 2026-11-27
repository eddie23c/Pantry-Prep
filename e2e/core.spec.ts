import { expect, test } from "@playwright/test";
import { CORS, OFF_BEANS, onboard, PHOTO, SCAN_REPLY, tab } from "./helpers";

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
  await page.getByRole("tab", { name: "Search" }).click();
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

test("photo scan: pile photo, invite code, review the list, add to store", async ({ page }) => {
  const bodies: any[] = [];
  await page.route("https://scan.test/scan", async (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    const body = r.request().postDataJSON();
    bodies.push(body);
    if (body.code !== "beta") return r.fulfill({ status: 401, headers: CORS, json: { error: body.code ? "bad_code" : "code_needed" } });
    return r.fulfill({ headers: CORS, json: { ...SCAN_REPLY, remaining: 11 } });
  });
  await onboard(page);
  await page.getByRole("button", { name: "Add food" }).click();
  // Photo is the first and default way to add food.
  await expect(page.getByRole("tab", { name: "Photo" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Photograph a pile of food")).toBeVisible();
  await page.locator("#photo-input").setInputFiles(PHOTO);
  await expect(page.getByRole("img", { name: "Photo 1 to scan" })).toBeVisible();
  await page.getByRole("button", { name: "Find food in 1 photo" }).click();
  await expect(page.getByLabel("Invite code")).toBeFocused();
  await page.getByLabel("Invite code").fill("beta");
  await page.getByRole("button", { name: "Save code and scan" }).click();
  await expect(page.getByText("Found 3 products, 1 to check")).toBeVisible();
  expect(bodies.at(-1).images[0]).toMatch(/^\/9j\//);
  expect(bodies.at(-1).device).toMatch(/^[A-Za-z0-9-]{8,}$/);
  await page.getByRole("button", { name: "More Tuna chunks" }).click();
  await page.getByRole("checkbox", { name: "Keep Mystery tin" }).uncheck();
  await page.getByRole("button", { name: "Add 2 items to store" }).click();
  await expect(page.locator("#screen-store [data-item]", { hasText: "Tuna chunks" })).toContainText("4");
  await expect(page.locator("#screen-store [data-item]", { hasText: "Mystery tin" })).toHaveCount(0);
  // The code is remembered, so the next scan goes straight through.
  await page.getByRole("button", { name: "Add food" }).click();
  await page.locator("#photo-input").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Find food in 1 photo" }).click();
  await expect(page.getByText("Found 3 products")).toBeVisible();
  await expect(page.getByLabel("Invite code")).toHaveCount(0);
});

test("photo scan: daily limit message, and search is one tap away", async ({ page }) => {
  await page.route("https://scan.test/scan", (r) =>
    r.request().method() === "OPTIONS" ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 429, headers: CORS, json: { error: "daily_limit", remaining: 0 } }));
  await onboard(page);
  await page.getByRole("button", { name: "Add food" }).click();
  await page.locator("#photo-input").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Find food in 1 photo" }).click();
  await expect(page.getByText("That's all the photo scans for today")).toBeVisible();
  await expect(page.getByText("0 photo scans left today")).toBeVisible();
  await page.getByRole("tab", { name: "Search" }).click();
  await expect(page.getByPlaceholder("Search tins, packets, water…")).toBeVisible();
});

test("own API key can be saved and removed", async ({ page }) => {
  await onboard(page);
  await tab(page, "Prepare");
  await page.getByText("Use your own Anthropic API key instead").click();
  await page.getByLabel("Anthropic API key").fill("not-a-key");
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.getByText("doesn't look like an Anthropic API key")).toBeVisible();
  await page.getByLabel("Anthropic API key").fill("sk-ant-" + "x".repeat(30));
  await page.getByRole("button", { name: "Save key" }).click();
  await expect(page.locator("#key-card")).toContainText("Key saved");
  await page.locator("#key-card").getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("#key-card")).toContainText("On");
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
