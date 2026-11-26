import { describe, expect, it } from "vitest";
import { buildPrintFile } from "./print";
import { defaultState, fromCat } from "./storage";

const now = new Date(2026, 10, 26);

describe("print file", () => {
  it("lists items soonest best-before first, with dates", () => {
    const s = defaultState();
    s.items = [{ ...fromCat("tuna", 2), bb: "2027-06-01" }, fromCat("oats", 1), { ...fromCat("pb", 1), bb: "2027-01-15" }];
    const html = buildPrintFile(s, "https://example.org/app/", now);
    const order = ["Peanut butter", "Tuna chunks", "Porridge oats"].map((n) => html.indexOf(n));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain("15 Jan 2027");
    expect(html).toContain("26 November 2026");
  });
  it("puts four recipe cards on each sheet and flags allergens", () => {
    const s = defaultState();
    s.picked = ["r1", "r2", "r3", "r4", "r5"];
    const html = buildPrintFile(s, "https://example.org/", now);
    expect(html.match(/class="sheet"/g)).toHaveLength(2);
    expect(html).toContain("May contain cereals with gluten, fish");
  });
  it("includes a QR code and escapes item names", () => {
    const s = defaultState();
    s.items = [{ ...fromCat("tuna", 1), name: "<script>x</script>" }];
    const html = buildPrintFile(s, "https://example.org/", now);
    expect(html).toContain("<svg");
    expect(html).not.toContain("<script>x");
  });
});
