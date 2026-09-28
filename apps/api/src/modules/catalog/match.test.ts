import { describe, expect, it } from "vitest";
import { canonicalName } from "./aliases";
import { matchRecipe, scoreRecipes } from "./match";
import { RECIPES } from "./recipes";

describe("recipe matching", () => {
  it("seeds about 24 recipes with stable ids and canonical ingredients", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(24);
    expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(RECIPES.length);
    for (const recipe of RECIPES) {
      for (const ingredient of recipe.ingredients) {
        expect(canonicalName(ingredient.name)).toBe(ingredient.name);
      }
    }
  });

  it("treats scallion and green onion as the same food", () => {
    const recipe = RECIPES.find((entry) => entry.id === "scallion-noodles");
    expect(recipe).toBeTruthy();
    const stock = new Set([canonicalName("scallion"), canonicalName("noodles"), canonicalName("soy sauce")]);
    const scored = matchRecipe(recipe!, stock, new Set());
    expect(scored.onHand).toContain("green onion");
    expect(scored.onHand).toContain("noodle");
    expect(scored.missing).toEqual(["egg", "garlic"]);
    expect(scored.matchPercent).toBe(60);
  });

  it("ranks a closer recipe above an empty match", () => {
    const stock = new Set([canonicalName("egg"), canonicalName("spinach"), canonicalName("green onion")]);
    const [best] = scoreRecipes(RECIPES, stock, new Set([canonicalName("spinach")]));
    expect(best?.recipe.id).toBe("spinach-scramble");
    expect(best?.matchPercent).toBe(100);
  });
});
