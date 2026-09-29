import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AppPorts } from "../../infra/prisma-ports";
import { HttpError } from "../../infra/errors";
import { readBody, requireUser } from "../../http/parse";
import { readToday } from "../../http/query";
import { assertMembership } from "../household/access";
import { RECIPES } from "../catalog/recipes";
import { rankFavorites } from "./favorites";
import { toPantryItem } from "../inventory/freshness";
import { useItem } from "../inventory/use-cases";
import { createUnitConverter } from "./openai-unit-converter";
import { useMeal, type UnitConverter } from "./use-meal";

const useSchema = z.object({
  quantity: z.number().positive("Quantity must be greater than zero."),
});

const useMealSchema = z.object({
  quantities: z
    .array(
      z.object({
        ingredient: z.string().trim().min(1).max(80),
        quantity: z.number().positive("Quantity must be greater than zero."),
      }),
    )
    .optional(),
});

export function consumptionPlugin(
  ports: AppPorts,
  converter: UnitConverter | null = createUnitConverter(),
): FastifyPluginAsync {
  return async (app) => {
    app.post("/households/:householdId/items/:itemId/use", async (request) => {
      const user = requireUser(request);
      const { householdId, itemId } = request.params as { householdId: string; itemId: string };
      const body = readBody(useSchema, request.body);
      const item = await useItem(ports, user.id, householdId, itemId, body.quantity);
      return { item: toPantryItem(item, readToday(request.query)) };
    });

    app.post("/households/:householdId/meals/:recipeId/use", async (request) => {
      const user = requireUser(request);
      const { householdId, recipeId } = request.params as { householdId: string; recipeId: string };
      const recipe = RECIPES.find((entry) => entry.id === recipeId);
      if (!recipe) throw new HttpError(404, "not_found", "That recipe is not in the catalog.");
      const body = readBody(useMealSchema, request.body ?? {});
      return useMeal(ports, converter, {
        userId: user.id,
        householdId,
        recipe,
        quantities: body.quantities,
      });
    });

    app.get("/households/:householdId/favorites", async (request) => {
      const user = requireUser(request);
      const { householdId } = request.params as { householdId: string };
      assertMembership(await ports.membership(user.id, householdId));
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 30);
      const [items, counts] = await Promise.all([ports.listItems(householdId), ports.useCounts(householdId, since)]);
      const countById = new Map(counts.map((row) => [row.itemId, row.count]));
      return {
        favorites: rankFavorites(
          items.map((item) => ({
            itemId: item.id,
            name: item.name,
            pinned: item.pinned,
            useCount30d: countById.get(item.id) ?? 0,
          })),
        ),
      };
    });
  };
}
