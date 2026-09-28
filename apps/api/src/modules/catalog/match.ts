import type { MealSuggestion, MealType } from "@smart-pantry/contracts";
import { canonicalName } from "./aliases";
import type { Recipe } from "./recipes";

export interface ScoredRecipe {
  recipe: Recipe;
  matchPercent: number;
  onHand: string[];
  missing: string[];
  expiringUsed: string[];
  rank: number;
}

export function matchRecipe(recipe: Recipe, stock: Set<string>, expiring: Set<string>): ScoredRecipe {
  const onHand: string[] = [];
  const missing: string[] = [];
  const expiringUsed: string[] = [];
  for (const ingredient of recipe.ingredients) {
    const name = canonicalName(ingredient.name);
    if (stock.has(name)) {
      onHand.push(ingredient.name);
      if (expiring.has(name)) expiringUsed.push(ingredient.name);
    } else {
      missing.push(ingredient.name);
    }
  }
  const matchPercent =
    recipe.ingredients.length === 0 ? 0 : Math.round((onHand.length / recipe.ingredients.length) * 100);
  return {
    recipe,
    matchPercent,
    onHand,
    missing,
    expiringUsed,
    rank: matchPercent + expiringUsed.length * 5,
  };
}

export function scoreRecipes(recipes: Recipe[], stock: Set<string>, expiring: Set<string>): ScoredRecipe[] {
  return recipes
    .map((recipe) => matchRecipe(recipe, stock, expiring))
    .sort((a, b) => b.rank - a.rank || a.recipe.name.localeCompare(b.recipe.name));
}

export function adviceFor(scored: ScoredRecipe): string {
  const { recipe, missing, expiringUsed } = scored;
  const have =
    missing.length === 0
      ? "You already have every ingredient."
      : `You would still need ${missing.join(", ")}.`;
  const expiry = expiringUsed.length > 0 ? ` It uses ${expiringUsed.join(", ")} before they expire.` : "";
  return `${recipe.name} fits what is in the kitchen. ${have}${expiry} Nutrition figures are estimates from the catalog, not medical advice.`;
}

export function toSuggestion(scored: ScoredRecipe, advice = adviceFor(scored)): MealSuggestion {
  return {
    recipeId: scored.recipe.id,
    name: scored.recipe.name,
    mealType: scored.recipe.mealType,
    matchPercent: scored.matchPercent,
    onHand: scored.onHand,
    missing: scored.missing,
    steps: scored.recipe.steps,
    nutrition: scored.recipe.nutrition,
    advice,
    nearMatch: scored.matchPercent >= 50 && scored.missing.length > 0,
  };
}

export function selectMeals(scored: ScoredRecipe[]): MealSuggestion[] {
  const picked: ScoredRecipe[] = [];
  const types: MealType[] = ["breakfast", "lunch", "dinner"];
  for (const type of types) {
    const best = scored.find((row) => row.recipe.mealType === type);
    if (best) picked.push(best);
  }
  for (const row of scored) {
    if (picked.length >= 9) break;
    if (!picked.includes(row)) picked.push(row);
  }
  return picked.map((row) => toSuggestion(row));
}

export function onePerMeal(meals: MealSuggestion[]): MealSuggestion[] {
  const types: MealType[] = ["breakfast", "lunch", "dinner"];
  return types.flatMap((type) => {
    const meal = meals.find((candidate) => candidate.mealType === type);
    return meal ? [meal] : [];
  });
}
