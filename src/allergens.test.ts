import { describe, expect, it } from "vitest";
import { fitsDiet, recipeAllergens, unsuitable } from "./allergens";
import { RECIPES } from "./data";

const r = (id: string) => RECIPES.find((x) => x.id === id)!;

describe("allergens", () => {
  it("flags allergens from every ingredient", () => {
    expect(recipeAllergens(r("r1"))).toEqual(["gluten", "fish"]);
    expect(recipeAllergens(r("r16"))).toContain("peanuts");
  });
  it("explains why a recipe is unsuitable", () => {
    expect(unsuitable(r("r1"), ["fish"], "none")).toBe("May contain fish");
    expect(unsuitable(r("r1"), [], "vegetarian")).toBe("Not vegetarian");
    expect(unsuitable(r("r2"), ["fish"], "vegan")).toBeNull();
  });
  it("lets an optional ingredient break a diet without hiding the recipe", () => {
    // Overnight oats has optional honey and needs milk, so it is vegetarian but not vegan.
    expect(fitsDiet(r("r4"), "vegetarian")).toBe(true);
    expect(fitsDiet(r("r4"), "vegan")).toBe(false);
  });
});
