import type { AdviceSource, LocationName, MealSuggestion, ShoppingNeed } from "@smart-pantry/contracts";
import { canonicalName } from "../catalog/aliases";
import { addDays } from "../catalog/dates";
import { adviceFor, matchRecipe, onePerMeal, scoreRecipes, selectMeals, toSuggestion } from "../catalog/match";
import type { Recipe } from "../catalog/recipes";
import { rankFavorites } from "../consumption/favorites";
import type { ItemDraft } from "../inventory/freshness";
import { redactValue, stripSecrets } from "../../infra/redact";
import { groundDraft, type ModelDraft } from "./grounding";
import { applyShoppingNotes, planShopping, stockFingerprint } from "./shopping";

export interface AdviceContext {
  stock: {
    name: string;
    quantity: number;
    unit: string;
    location: LocationName;
    expiryDate: string | null;
  }[];
  favorites: { name: string; useCount: number }[];
  recipes: {
    id: string;
    name: string;
    mealType: string;
    ingredients: string[];
    nutrition: Recipe["nutrition"];
  }[];
}

export interface RecommendationModel {
  advise(input: AdviceContext): Promise<ModelDraft>;
}

export interface AdviceResult {
  source: AdviceSource;
  meals: MealSuggestion[];
  homeMeals: MealSuggestion[];
  shopping: ShoppingNeed[];
  favorites: ReturnType<typeof rankFavorites>;
}

function stockSets(items: ItemDraft[], locations: LocationName[], today: string) {
  const names = new Set<string>();
  const expiring = new Set<string>();
  const soon = addDays(today, 3);
  for (const item of items) {
    const canon = canonicalName(item.name);
    for (const lot of item.lots) {
      if (lot.quantity <= 0 || !locations.includes(lot.location)) continue;
      names.add(canon);
      if (lot.expiryDate && lot.expiryDate >= today && lot.expiryDate <= soon) expiring.add(canon);
    }
  }
  return { names, expiring };
}

export async function buildAdvice(input: {
  items: ItemDraft[];
  useCounts: { itemId: string; count: number }[];
  locations: LocationName[];
  recipes: Recipe[];
  today: string;
  model: RecommendationModel | null;
  dismissals?: { key: string; stockFingerprint: string }[];
}): Promise<AdviceResult> {
  const counts = new Map(input.useCounts.map((row) => [row.itemId, row.count]));
  const favorites = rankFavorites(
    input.items.map((item) => ({
      itemId: item.id,
      name: item.name,
      pinned: item.pinned,
      useCount30d: counts.get(item.id) ?? 0,
    })),
  );
  const { names, expiring } = stockSets(input.items, input.locations, input.today);
  const scored = scoreRecipes(input.recipes, names, expiring);
  const fingerprint = stockFingerprint(input.items);
  const shopping = planShopping({
    items: input.items,
    favorites,
    scored,
    dismissals: input.dismissals ?? [],
    fingerprint,
  });
  const matcherMeals = selectMeals(scored);
  const matcherFallback = (): AdviceResult => ({
    source: "matcher",
    meals: matcherMeals,
    homeMeals: onePerMeal(matcherMeals),
    shopping,
    favorites,
  });
  const context: AdviceContext = {
    stock: input.items.flatMap((item) =>
      item.lots
        .filter((lot) => lot.quantity > 0 && input.locations.includes(lot.location))
        .map((lot) => ({
          name: item.name,
          quantity: lot.quantity,
          unit: item.unit,
          location: lot.location,
          expiryDate: lot.expiryDate,
        })),
    ),
    favorites: favorites.map((favorite) => ({ name: favorite.name, useCount: favorite.useCount })),
    recipes: input.recipes.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      mealType: recipe.mealType,
      ingredients: recipe.ingredients.map((ingredient) => ingredient.name),
      nutrition: recipe.nutrition,
    })),
  };

  if (!input.model) return matcherFallback();

  try {
    const draft = await input.model.advise(context);
    const grounded = groundDraft(draft, input.recipes);
    if (!grounded) return matcherFallback();
    const meals = grounded.meals.map((meal) => {
      const scoredMeal = matchRecipe(meal.recipe, names, expiring);
      return toSuggestion(scoredMeal, stripSecrets(meal.advice));
    });
    for (const fallback of matcherMeals) {
      if (!meals.some((meal) => meal.mealType === fallback.mealType)) meals.push(fallback);
    }
    return {
      source: "model",
      meals,
      homeMeals: onePerMeal(meals),
      shopping: applyShoppingNotes(shopping, grounded.shoppingNotes),
      favorites,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Recommendation model failed; using matcher fallback.", redactValue(message));
    return matcherFallback();
  }
}

export function matcherAdvice(recipe: Recipe, stock: Set<string>, expiring: Set<string>): string {
  return adviceFor(matchRecipe(recipe, stock, expiring));
}
