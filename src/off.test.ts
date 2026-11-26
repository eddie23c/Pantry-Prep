import { describe, expect, it } from "vitest";
import { classify, packSize, toDraft, validCheckDigit } from "./off";

describe("barcodes", () => {
  it("checks the GS1 check digit", () => {
    expect(validCheckDigit("5000157024886")).toBe(true); // a real EAN-13
    expect(validCheckDigit("5000157024887")).toBe(false);
    expect(validCheckDigit("96385074")).toBe(true); // EAN-8
    expect(validCheckDigit("12ab")).toBe(false);
  });
});

describe("Open Food Facts mapping", () => {
  it("classifies by the most specific category", () => {
    expect(classify(["en:canned-foods", "en:legumes", "en:baked-beans"])).toEqual({ group: "protein", kind: "beans" });
    expect(classify(["en:beverages", "en:waters"])).toEqual({ group: "water", kind: "water" });
    expect(classify(["en:something-new"])).toEqual({ group: "other", kind: null });
  });
  it("reads pack sizes from either field", () => {
    expect(packSize({ product_quantity: 415, product_quantity_unit: "g" })).toBe(415);
    expect(packSize({ quantity: "1.5 L" })).toBe(1500);
    expect(packSize({ quantity: "4 x 400g" })).toBe(1600);
    expect(packSize({ quantity: "a tin" })).toBe(0);
  });
  it("turns per-100 g figures into per-pack figures", () => {
    const d = toDraft("5000157024886", {
      product_name: "Baked Beans in Tomato Sauce", brands: "Heinz, Kraft", quantity: "415 g", product_quantity: 415,
      categories_tags: ["en:baked-beans"], nutriments: { "energy-kcal_100g": 78, proteins_100g: 4.7, fiber_100g: 3.7 },
    });
    expect(d).toMatchObject({ name: "Heinz Baked Beans in Tomato Sauce", group: "protein", kind: "beans", kcal: 324, protein: 20, fibre: 15, portions: 2, guessedSize: false });
  });
  it("stores water as litres and flags a missing size", () => {
    expect(toDraft("1", { product_name: "Still water", quantity: "2 L", categories_tags: ["en:waters"] })).toMatchObject({ litres: 2, kcal: 0 });
    expect(toDraft("1", { product_name: "Mystery", nutriments: { energy_100g: 418.4 } })).toMatchObject({ kcal: 100, guessedSize: true });
  });
});
