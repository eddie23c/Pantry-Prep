import { expect, test } from "@playwright/test";
import { onboard, tab } from "./helpers";

test("kit list fits the household: baby and pet items appear only when needed", async ({ page }) => {
  await onboard(page);
  await tab(page, "Prepare");
  const kit = page.locator(".check-list");
  await expect(kit).not.toContainText("Baby formula");
  await expect(kit).not.toContainText("Pet food");
  await page.getByLabel("Baby or toddler at home").check();
  await expect(kit).toContainText("Baby formula, nappies and wipes");
  await page.getByRole("button", { name: "More Pets" }).click();
  await expect(kit).toContainText("Pet food and water");
  await page.reload();
  await expect(page.getByLabel("Baby or toddler at home")).toBeChecked();
});

test("removing an item can be undone", async ({ page }) => {
  await onboard(page, { example: true });
  await tab(page, "Store");
  const first = page.locator("#screen-store .row-btn").first();
  const name = (await first.locator(".t").textContent())!;
  await first.click();
  await page.getByRole("button", { name: "Remove from store" }).click();
  await expect(page.locator(".toast")).toContainText(`Removed ${name}`);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("#screen-store").getByText(name, { exact: true }).first()).toBeVisible();
});

test("next check can be added to the calendar", async ({ page }) => {
  await onboard(page);
  await tab(page, "Prepare");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add next check to my calendar" }).click();
  expect((await download).suggestedFilename()).toBe("pantry-prep-check.ics");
  await expect(page.locator(".kit-check ~ .status")).toContainText("add a reminder");
});

test("feedback sheet fills in a link with the note", async ({ page }) => {
  await onboard(page);
  await tab(page, "Prepare");
  await page.getByRole("button", { name: "Send feedback" }).click();
  const dialog = page.getByRole("dialog", { name: "Send feedback" });
  await dialog.getByLabel("Your feedback").fill("Scan missed my soup");
  await expect(dialog.getByRole("link", { name: "Send feedback" })).toHaveAttribute("href", /Scan%20missed%20my%20soup/);
});
