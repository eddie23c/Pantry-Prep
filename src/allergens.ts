// The 14 major allergens in UK food law, and which store-cupboard kinds commonly contain them.
// This is a cautious "may contain" guide: recipes are flagged if ANY version of an ingredient
// often contains the allergen. Brands differ, so the app always says to check the pack.
import type { Recipe } from "./data";

export const ALLERGENS = {
  celery: "Celery",
  gluten: "Cereals with gluten",
  crustaceans: "Crustaceans",
  eggs: "Eggs",
  fish: "Fish",
  lupin: "Lupin",
  milk: "Milk",
  molluscs: "Molluscs",
  mustard: "Mustard",
  nuts: "Tree nuts",
  peanuts: "Peanuts",
  sesame: "Sesame",
  soya: "Soya",
  sulphites: "Sulphites",
} as const;
export type AllergenId = keyof typeof ALLERGENS;

export const DIETS = { none: "No special diet", vegetarian: "Vegetarian", vegan: "Vegan" } as const;
export type Diet = keyof typeof DIETS;

/** Allergens commonly found in each kind of store-cupboard food. */
export const KIND_ALLERGENS: Record<string, AllergenId[]> = {
  fish: ["fish"],
  driedfruit: ["sulphites"],
  nuts: ["nuts", "peanuts"],
  nutbutter: ["peanuts"],
  crackers: ["gluten"],
  oats: ["gluten"],
  cereal: ["gluten"],
  wraps: ["gluten"],
  pasta: ["gluten"],
  noodles: ["gluten", "soya"],
  milk: ["milk"],
  pudding: ["milk"],
  soup: ["celery", "milk", "gluten"],
  snack: ["milk", "gluten", "nuts", "soya"],
};

const NOT_VEGETARIAN = new Set(["fish", "meat"]);
const NOT_VEGAN = new Set(["fish", "meat", "milk", "pudding", "honey"]);

/** Allergens a recipe may contain, from its required and optional ingredients. */
export function recipeAllergens(r: Recipe): AllergenId[] {
  const found = new Set<AllergenId>();
  for (const ing of r.ings) for (const k of ing.k) for (const a of KIND_ALLERGENS[k] || []) found.add(a);
  return (Object.keys(ALLERGENS) as AllergenId[]).filter((a) => found.has(a));
}

/** True if the recipe's required ingredients can be met within the diet. */
export function fitsDiet(r: Recipe, diet: Diet): boolean {
  if (diet === "none") return true;
  const banned = diet === "vegan" ? NOT_VEGAN : NOT_VEGETARIAN;
  return r.ings.filter((i) => !i.opt).every((i) => i.k.some((k) => !banned.has(k)));
}

/** Why a recipe doesn't suit the household, or null if it does. */
export function unsuitable(r: Recipe, allergies: AllergenId[], diet: Diet): string | null {
  const clash = recipeAllergens(r).filter((a) => allergies.includes(a));
  if (clash.length) return "May contain " + clash.map((a) => ALLERGENS[a].toLowerCase()).join(", ");
  if (!fitsDiet(r, diet)) return "Not " + DIETS[diet].toLowerCase();
  return null;
}
