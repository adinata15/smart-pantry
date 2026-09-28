import { describe, expect, it } from "vitest";
import type { AdviceSource, MealSuggestion } from "@smart-pantry/contracts";
import { RECIPES } from "../catalog/recipes";
import { buildAdvice, type RecommendationModel } from "./advise";
import { groundDraft, type ModelDraft } from "./grounding";

const scramble = RECIPES.find((recipe) => recipe.id === "spinach-scramble")!;

function model(draft: ModelDraft): RecommendationModel {
  return { advise: async () => draft };
}

describe("nutrition grounding", () => {
  it("rejects an invented recipe id", () => {
    expect(groundDraft({ meals: [{ recipeId: "not-a-recipe", advice: "Make this." }], shoppingNotes: [] }, RECIPES)).toBeNull();
  });

  it("rejects nutrition numbers that are not the catalog facts", () => {
    expect(
      groundDraft(
        {
          meals: [{ recipeId: scramble.id, advice: "Cook it.", nutrition: { ...scramble.nutrition, calories: 9999 } }],
          shoppingNotes: [],
        },
        RECIPES,
      ),
    ).toBeNull();
  });

  it("falls back to the matcher when the model invents an id or nutrition", async () => {
    const base = {
      items: [],
      useCounts: [],
      locations: ["refrigerator" as const],
      recipes: RECIPES,
      today: "2026-09-28",
    };
    const invented = await buildAdvice({ ...base, model: model({ meals: [{ recipeId: "nope", advice: "Invented." }], shoppingNotes: [] }) });
    const wrongNumbers = await buildAdvice({
      ...base,
      model: model({
        meals: [{ recipeId: scramble.id, advice: "Cook it.", nutrition: { ...scramble.nutrition, protein: 500 } }],
        shoppingNotes: [],
      }),
    });
    expect(invented.source).toBe("matcher");
    expect(wrongNumbers.source).toBe("matcher");
    expect(wrongNumbers.meals.every((meal) => meal.nutrition.protein !== 500)).toBe(true);
  });

  it("keeps catalog nutrition when the model cites a real recipe", async () => {
    const result = await buildAdvice({
      items: [
        {
          id: "eggs",
          householdId: "house-a",
          name: "Eggs",
          unit: "each",
          parLevel: 12,
          pinned: false,
          lots: [{ id: "lot", location: "refrigerator", quantity: 1, expiryDate: null }],
        },
      ],
      useCounts: [],
      locations: ["refrigerator"],
      recipes: [scramble],
      today: "2026-09-28",
      model: model({
        meals: [{ recipeId: scramble.id, advice: "A practical scramble from what you have." }],
        shoppingNotes: [{ name: "egg", note: "Buy 99 eggs because the model said so." }],
      }),
    });
    expect(result.source).toBe<AdviceSource>("model");
    const meal = result.meals.find((entry) => entry.recipeId === scramble.id) as MealSuggestion;
    expect(meal.nutrition).toEqual(scramble.nutrition);
    expect(meal.advice).toContain("practical scramble");
    expect(result.shopping.every((need) => need.suggestedQuantity !== 99)).toBe(true);
  });

  it("uses the matcher when no model is configured", async () => {
    const result = await buildAdvice({
      items: [],
      useCounts: [],
      locations: ["refrigerator"],
      recipes: RECIPES,
      today: "2026-09-28",
      model: null,
    });
    expect(result.source).toBe("matcher");
    expect(result.meals.length).toBeGreaterThan(0);
  });
});
