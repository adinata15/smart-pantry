import { describe, expect, it } from "vitest";
import { scoreRecipes } from "../catalog/match";
import type { Recipe } from "../catalog/recipes";
import type { ItemDraft } from "../inventory/freshness";
import { planShopping, stockFingerprint } from "./shopping";

const noodles: Recipe = {
  id: "scallion-noodles",
  name: "Scallion noodles",
  mealType: "dinner",
  servings: 2,
  ingredients: [
    { name: "noodle", quantity: 200, unit: "g" },
    { name: "green onion", quantity: 3, unit: "each" },
    { name: "soy sauce", quantity: 1, unit: "tbsp" },
    { name: "egg", quantity: 1, unit: "each" },
    { name: "garlic", quantity: 1, unit: "clove" },
  ],
  steps: ["Boil.", "Toss."],
  nutrition: { calories: 470, protein: 18, carbs: 68, fat: 12, fiber: 4, sodium: 700 },
};

function item(partial: Partial<ItemDraft> & Pick<ItemDraft, "id" | "name">): ItemDraft {
  return {
    householdId: "house-a",
    unit: "each",
    parLevel: null,
    pinned: false,
    lots: [{ id: `${partial.id}-lot`, location: "refrigerator", quantity: 1, expiryDate: null }],
    ...partial,
  };
}

describe("planShopping", () => {
  it("suggests the gap below par, a scarce favorite, and a missing near-match ingredient", () => {
    const items = [
      item({ id: "milk", name: "Milk", parLevel: 2, lots: [{ id: "m", location: "refrigerator", quantity: 1, expiryDate: null }] }),
      item({ id: "eggs", name: "Eggs", lots: [{ id: "e", location: "refrigerator", quantity: 1, expiryDate: null }] }),
      item({ id: "noodles", name: "Noodles", lots: [{ id: "n", location: "pantry", quantity: 1, expiryDate: null }] }),
      item({ id: "onion", name: "Scallion", lots: [{ id: "s", location: "refrigerator", quantity: 2, expiryDate: null }] }),
      item({ id: "soy", name: "Soy sauce", unit: "tbsp", lots: [{ id: "y", location: "pantry", quantity: 1, expiryDate: null }] }),
    ];
    const scored = scoreRecipes([noodles], new Set(["noodle", "green onion", "soy sauce"]), new Set());
    const needs = planShopping({
      items,
      favorites: [{ name: "Eggs", useCount: 2, pinned: false }],
      scored,
      dismissals: [],
      fingerprint: stockFingerprint(items),
    });
    expect(needs.find((need) => need.key === "milk")).toMatchObject({
      reason: "below-par",
      suggestedQuantity: 1,
    });
    expect(needs.find((need) => need.key === "egg")).toMatchObject({
      reason: "favorite-running-low",
      suggestedQuantity: 1,
    });
    expect(needs.find((need) => need.name === "garlic")?.reason).toBe("missing-ingredient");
    expect(needs.find((need) => need.key === "green onion")).toBeUndefined();
  });

  it("keeps a checked item hidden until stock changes", () => {
    const items = [item({ id: "milk", name: "Milk", parLevel: 4 })];
    const fingerprint = stockFingerprint(items);
    const hidden = planShopping({
      items,
      favorites: [],
      scored: [],
      dismissals: [{ key: "milk", stockFingerprint: fingerprint }],
      fingerprint,
    });
    expect(hidden).toHaveLength(0);
    const restocked = [{ ...items[0]!, lots: [{ id: "m", location: "refrigerator" as const, quantity: 2, expiryDate: null }] }];
    const visible = planShopping({
      items: restocked,
      favorites: [],
      scored: [],
      dismissals: [{ key: "milk", stockFingerprint: fingerprint }],
      fingerprint: stockFingerprint(restocked),
    });
    expect(visible.map((need) => need.key)).toEqual(["milk"]);
  });
});
