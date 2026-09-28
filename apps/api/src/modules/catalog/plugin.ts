import type { FastifyPluginAsync } from "fastify";
import { requireUser } from "../../http/parse";
import { RECIPES } from "./recipes";

export function catalogPlugin(): FastifyPluginAsync {
  return async (app) => {
    app.get("/catalog/recipes", async (request) => {
      requireUser(request);
      return {
        recipes: RECIPES.map((recipe) => ({
          id: recipe.id,
          name: recipe.name,
          mealType: recipe.mealType,
          nutrition: recipe.nutrition,
        })),
      };
    });
  };
}
