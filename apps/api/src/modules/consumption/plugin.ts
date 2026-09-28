import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AppPorts } from "../../infra/prisma-ports";
import { readBody, requireUser } from "../../http/parse";
import { readToday } from "../../http/query";
import { assertMembership } from "../household/access";
import { rankFavorites } from "./favorites";
import { toPantryItem } from "../inventory/freshness";
import { useItem } from "../inventory/use-cases";

const useSchema = z.object({
  quantity: z.number().positive("Quantity must be greater than zero."),
});

export function consumptionPlugin(ports: AppPorts): FastifyPluginAsync {
  return async (app) => {
    app.post("/households/:householdId/items/:itemId/use", async (request) => {
      const user = requireUser(request);
      const { householdId, itemId } = request.params as { householdId: string; itemId: string };
      const body = readBody(useSchema, request.body);
      const item = await useItem(ports, user.id, householdId, itemId, body.quantity);
      return { item: toPantryItem(item, readToday(request.query)) };
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
