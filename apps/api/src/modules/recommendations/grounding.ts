import type { NutritionFacts } from "@smart-pantry/contracts";
import type { Recipe } from "../catalog/recipes";

export interface ModelMeal {
  recipeId: string;
  advice: string;
  nutrition?: NutritionFacts;
}

export interface ModelDraft {
  meals: ModelMeal[];
  shoppingNotes: { name: string; note: string }[];
}

export interface GroundedDraft {
  meals: { recipe: Recipe; advice: string }[];
  shoppingNotes: { name: string; note: string }[];
}

function sameNutrition(left: NutritionFacts, right: NutritionFacts): boolean {
  const keys: (keyof NutritionFacts)[] = ["calories", "protein", "carbs", "fat", "fiber", "sodium"];
  return keys.every((key) => Math.abs(left[key] - right[key]) < 0.01);
}

export function groundDraft(draft: ModelDraft | null, recipes: Recipe[]): GroundedDraft | null {
  if (!draft || draft.meals.length === 0) return null;
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const meals: GroundedDraft["meals"] = [];
  for (const meal of draft.meals) {
    const recipe = byId.get(meal.recipeId);
    if (!recipe) return null;
    if (meal.nutrition && !sameNutrition(meal.nutrition, recipe.nutrition)) return null;
    const advice = meal.advice.trim();
    if (!advice) return null;
    meals.push({ recipe, advice });
  }
  return { meals, shoppingNotes: draft.shoppingNotes ?? [] };
}
