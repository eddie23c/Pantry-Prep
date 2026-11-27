import { describe, expect, it } from "vitest";
import { daysCovered, eatUp, kitFor, kitState, level, recipeStatus, restoreEaten, shoppingList, targets, totals, type AppState } from "./calc";
import { KIT, RECIPES } from "./data";
import { fromCat } from "./storage";

const house = { adults: 2, children: 1, pets: 0, days: 3 };
const state = (items: AppState["items"], extra: Partial<AppState> = {}): AppState => ({ house, example: false, items, picked: [], kit: {}, allergies: [], diet: "none", onboarded: true, ...extra });

describe("targets", () => {
  it("uses 3 L of drinking water per person per day", () => {
    expect(targets(house).water).toBe(27);
  });
  it("adds adult and child energy for each day", () => {
    expect(targets(house).kcal).toBe((2 * 2000 + 1400) * 3);
  });
});

describe("totals", () => {
  it("multiplies pack nutrition by count", () => {
    const t = totals([fromCat("bakedbeans", 2), fromCat("water5", 3)]);
    expect(t.kcal).toBe(680);
    expect(t.water).toBe(15);
    expect(t.groups.protein).toBe(4);
    expect(t.packs).toBe(5);
  });
});

describe("daysCovered", () => {
  it("is limited by whichever runs out first", () => {
    // 2 adults, 1 child need 9 L a day; 18 L lasts 2 days.
    const d = daysCovered(state([fromCat("water2", 9), fromCat("oats", 5)]));
    expect(d.water).toBeCloseTo(2);
    expect(d.days).toBeCloseTo(2);
    expect(d.limiter).toBe("water");
  });
  it("is zero for an empty store", () => {
    expect(daysCovered(state([])).days).toBe(0);
  });
});

describe("level", () => {
  it("maps fractions to ok, warn and bad", () => {
    expect(level(1)).toBe("ok");
    expect(level(0.7)).toBe("warn");
    expect(level(0.2)).toBe("bad");
  });
});

describe("shoppingList", () => {
  it("suggests enough water to close the gap", () => {
    const line = shoppingList(state([])).find((l) => l.id === "water5");
    expect(line?.n).toBe(Math.ceil(27 / 5));
  });
  it("is empty once every target is met", () => {
    const big = [fromCat("water5", 6), fromCat("oats", 4), fromCat("peaches", 20), fromCat("chickpeas", 10), fromCat("milkpowder", 2), fromCat("pb", 2)];
    expect(shoppingList(state(big))).toEqual([]);
  });
});

describe("recipes", () => {
  it("counts a recipe ready when every required kind is held", () => {
    const r = RECIPES.find((x) => x.id === "r1")!;
    const s = recipeStatus(r, [fromCat("tuna", 1), fromCat("sweetcorn", 1), fromCat("crackers", 1)]);
    expect(s.ready).toBe(true);
  });
  it("ignores optional ingredients", () => {
    const r = RECIPES.find((x) => x.id === "r1")!;
    expect(recipeStatus(r, []).req).toBe(3);
  });
});

describe("kit checklist", () => {
  it("ticks water automatically once the store has enough", () => {
    const water = KIT.find((k) => k.id === "water")!;
    expect(kitState(water, state([fromCat("water5", 6)]))).toBe("auto");
    expect(kitState(water, state([]))).toBeNull();
  });
  it("keeps items seen in a photo", () => {
    const torch = KIT.find((k) => k.id === "torch")!;
    expect(kitState(torch, state([], { kit: { torch: "photo" } }))).toBe("photo");
  });
});

describe("kit fits the household", () => {
  it("lists pet and baby items only when they apply", () => {
    const ids = (s: AppState) => kitFor(s).map((k) => k.id);
    expect(ids(state([]))).not.toContain("baby");
    expect(ids(state([], { baby: true }))).toContain("baby");
    expect(ids(state([], { house: { ...house, pets: 0 } }))).not.toContain("pets");
    expect(ids(state([], { house: { ...house, pets: 1 } }))).toContain("pets");
    expect(kitFor(state([], { baby: true, house: { ...house, pets: 1 } })).length).toBe(KIT.length);
  });
});

describe("eat and replace", () => {
  it("moves an eaten item to the restock list without its dates, and undo puts it back", async () => {
    const { defaultState } = await import("./storage");
    const s = defaultState();
    const it = s.items[0];
    it.bb = "2027-01-01";
    eatUp(s, it.uid);
    expect(s.items.some((x) => x.uid === it.uid)).toBe(false);
    expect(s.restock).toEqual([expect.objectContaining({ uid: it.uid, name: it.name })]);
    expect(s.restock![0].bb).toBeUndefined();
    restoreEaten(s, it, 0);
    expect(s.items[0].uid).toBe(it.uid);
    expect(s.restock).toBeUndefined();
  });
});
