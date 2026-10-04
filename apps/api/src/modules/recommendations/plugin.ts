import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AppPorts } from "../../infra/prisma-ports";
import { readBody, requireUser } from "../../http/parse";
import { readLocations, readToday } from "../../http/query";
import { assertMembership } from "../household/access";
import { isExpiringSoon, toPantryItem } from "../inventory/freshness";
import { RECIPES } from "../catalog/recipes";
import { buildAdvice, type RecommendationModel } from "./advise";
import { CHAT_HISTORY_LIMIT, sendKitchenChat, type KitchenChatModel } from "./chat";
import { resolveKitchenChatModel, resolveRecommendationModel } from "./resolve-model";
import { stockFingerprint } from "./shopping";

const dismissSchema = z.object({
  key: z.string().trim().min(1).max(80),
});

const chatHistoryTurnSchema = z.object({
  role: z.enum(["member", "pantry"]),
  body: z.string().trim().min(1).max(8000),
});

const chatSchema = z.object({
  text: z.string().trim().min(1, "Write a message.").max(2000, "Keep the message under 2000 characters."),
  history: z.array(chatHistoryTurnSchema).max(CHAT_HISTORY_LIMIT).default([]),
});

async function loadAdvice(
  ports: AppPorts,
  processModel: RecommendationModel | null,
  userId: string,
  householdId: string,
  query: unknown,
) {
  assertMembership(await ports.membership(userId, householdId));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const [items, useCounts, dismissals, householdName, model] = await Promise.all([
    ports.listItems(householdId),
    ports.useCounts(householdId, since),
    ports.listDismissals(householdId),
    ports.householdName(householdId),
    resolveRecommendationModel(ports, userId, processModel),
  ]);
  const advice = await buildAdvice({
    items,
    useCounts,
    locations: readLocations(query),
    recipes: RECIPES,
    today: readToday(query),
    model,
    dismissals,
  });
  return {
    items,
    advice,
    householdName: householdName ?? "Household",
    fingerprint: stockFingerprint(items),
    useCounts,
    dismissals,
  };
}

export function recommendationsPlugin(
  ports: AppPorts,
  processModel: RecommendationModel | null,
  processChatModel: KitchenChatModel | null,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/households/:householdId/meals", async (request) => {
      const user = requireUser(request);
      const { householdId } = request.params as { householdId: string };
      const { advice } = await loadAdvice(ports, processModel, user.id, householdId, request.query);
      return { source: advice.source, meals: advice.meals };
    });

    app.get("/households/:householdId/shopping", async (request) => {
      const user = requireUser(request);
      const { householdId } = request.params as { householdId: string };
      const query = { ...(request.query as object), locations: "all" };
      const { advice } = await loadAdvice(ports, processModel, user.id, householdId, query);
      return { source: advice.source, needs: advice.shopping };
    });

    app.post("/households/:householdId/shopping/dismiss", async (request) => {
      const user = requireUser(request);
      const { householdId } = request.params as { householdId: string };
      const body = readBody(dismissSchema, request.body);
      assertMembership(await ports.membership(user.id, householdId));
      const items = await ports.listItems(householdId);
      await ports.dismiss(householdId, body.key, stockFingerprint(items));
      return { ok: true };
    });

    app.get("/households/:householdId/home", async (request) => {
      const user = requireUser(request);
      const { householdId } = request.params as { householdId: string };
      const today = readToday(request.query);
      const { items, advice, householdName } = await loadAdvice(
        ports,
        processModel,
        user.id,
        householdId,
        request.query,
      );
      const pantry = items.map((item) => toPantryItem(item, today));
      return {
        householdName,
        refrigerator: pantry.filter((item) => item.lots.some((lot) => lot.location === "refrigerator" && lot.quantity > 0)),
        expiringSoon: pantry.filter((item) => isExpiringSoon(item, today)),
        meals: advice.homeMeals,
        shoppingCount: advice.shopping.length,
        favorites: advice.favorites.slice(0, 3),
        source: advice.source,
      };
    });

    app.post("/households/:householdId/chat", async (request) => {
      const user = requireUser(request);
      const { householdId } = request.params as { householdId: string };
      const body = readBody(chatSchema, request.body);
      assertMembership(await ports.membership(user.id, householdId));
      const model = await resolveKitchenChatModel(ports, user.id, processChatModel);
      return sendKitchenChat(ports, {
        householdId,
        memberName: user.displayName,
        text: body.text,
        today: readToday(request.query),
        recipes: RECIPES,
        history: body.history ?? [],
        model,
      });
    });
  };
}
