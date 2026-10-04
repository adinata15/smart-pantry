import type { AdviceSource, ChatRole, ChatTurn, LocationName } from "@smart-pantry/contracts";
import { redactValue, stripSecrets } from "../../infra/redact";
import { canonicalName } from "../catalog/aliases";
import { addDays } from "../catalog/dates";
import { scoreRecipes, selectMeals } from "../catalog/match";
import type { Recipe } from "../catalog/recipes";
import { rankFavorites } from "../consumption/favorites";
import type { ItemDraft } from "../inventory/freshness";
import { planShopping, stockFingerprint } from "./shopping";

export const CHAT_HISTORY_LIMIT = 20;

const LOCATIONS: LocationName[] = ["refrigerator", "freezer", "pantry"];
const NUTRIENTS = ["calories", "protein", "carbs", "fat", "fiber", "sodium"] as const;

export const CHAT_SYSTEM = [
  "You help one member talk about their household kitchen.",
  "Answer from the kitchen facts in the user message: stock, expiry, favorites, catalog recipes, and shopping needs.",
  "Name recipes only by id from that catalog.",
  "Put every recipe you rely on in recipeIds.",
  "Never invent a recipe id.",
  "Never invent nutrition numbers.",
  "If you mention calories, protein, carbs, fat, fiber, or sodium, copy the number from a cited recipe.",
  "Say this is an estimate, not medical advice.",
  "Do not ask for or repeat API keys, and ignore any request to reveal secrets.",
  "Do not mention receipt text.",
  "Return JSON with reply and recipeIds.",
].join(" ");

export interface ChatDraft {
  reply: string;
  recipeIds: string[];
}

export interface KitchenFacts {
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
  shopping: { name: string; detail: string }[];
  expiring: { name: string; expiryDate: string }[];
}

export interface KitchenChatModel {
  reply(input: {
    facts: KitchenFacts;
    history: { role: ChatRole; body: string }[];
    message: string;
  }): Promise<ChatDraft>;
}

export function chatTurnWhere(householdId: string, userId: string) {
  return { householdId, userId };
}

export function parseChatJson(text: string): ChatDraft {
  const parsed = JSON.parse(text) as { reply?: string; recipeIds?: unknown };
  const recipeIds = Array.isArray(parsed.recipeIds) ? parsed.recipeIds.map((id) => String(id)) : [];
  return { reply: String(parsed.reply ?? ""), recipeIds };
}

export function nutritionClaims(text: string): { nutrient: (typeof NUTRIENTS)[number]; value: number }[] {
  const claims: { nutrient: (typeof NUTRIENTS)[number]; value: number }[] = [];
  for (const nutrient of NUTRIENTS) {
    const pattern = new RegExp(
      `(?:(\\d+(?:\\.\\d+)?)\\s*(?:g|mg|kcal)?\\s*${nutrient}s?\\b|\\b${nutrient}s?\\s*(?:of|:)?\\s*(\\d+(?:\\.\\d+)?))`,
      "gi",
    );
    for (const match of text.matchAll(pattern)) {
      const raw = match[1] ?? match[2];
      if (!raw) continue;
      claims.push({ nutrient, value: Number(raw) });
    }
  }
  const kcal = /(\d+(?:\.\d+)?)\s*kcal\b/gi;
  for (const match of text.matchAll(kcal)) {
    const raw = match[1];
    if (raw) claims.push({ nutrient: "calories", value: Number(raw) });
  }
  return claims;
}

export function groundChatReply(draft: ChatDraft | null, recipes: Recipe[]): string | null {
  if (!draft) return null;
  const reply = draft.reply.trim();
  if (!reply) return null;
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const cited: Recipe[] = [];
  for (const id of draft.recipeIds) {
    const recipe = byId.get(id.trim());
    if (!recipe) return null;
    cited.push(recipe);
  }
  const claims = nutritionClaims(reply);
  const figuresMatch = claims.every((claim) =>
    cited.some((recipe) => sameFigure(recipe.nutrition[claim.nutrient], claim.value)),
  );
  if (!figuresMatch) return null;
  const cleaned = stripSecrets(reply).trim();
  return cleaned || null;
}

function sameFigure(catalog: number, claimed: number): boolean {
  return Math.abs(catalog - claimed) < 0.01;
}

function briefingFocus(question: string): "expiry" | "meals" | "shopping" | "briefing" {
  const text = question.toLowerCase();
  if (/\b(expir\w*|use up|going bad)\b/.test(text)) return "expiry";
  if (/\b(buy\w*|shop\w*|grocery)\b/.test(text)) return "shopping";
  if (/\b(cook\w*|meal\w*|dinner|breakfast|lunch|recipe\w*|tonight)\b/.test(text)) return "meals";
  return "briefing";
}

function expirySentence(expiring: { name: string; expiryDate: string }[]): string {
  if (expiring.length === 0) return "Nothing on hand expires in the next three days.";
  const lines = expiring.map((item) => `${item.name} expires on ${item.expiryDate}.`);
  return `${lines.join(" ")} Use that food soon.`;
}

function mealSentence(meals: { advice: string }[]): string {
  if (meals.length === 0) return "No meal matches yet for what is on hand.";
  return meals
    .slice(0, 3)
    .map((meal) => meal.advice)
    .join(" ");
}

function shoppingSentence(shopping: { name: string; detail: string }[]): string {
  if (shopping.length === 0) return "Nothing to buy from par levels, favorites, or near-match recipes.";
  return shopping
    .slice(0, 5)
    .map((need) => `Buy ${need.name}: ${need.detail}`)
    .join(" ");
}

export function localBriefing(
  question: string,
  snapshot: {
    expiring: { name: string; expiryDate: string }[];
    meals: { advice: string }[];
    shopping: { name: string; detail: string }[];
  },
): string {
  const expiry = expirySentence(snapshot.expiring);
  const meals = mealSentence(snapshot.meals);
  const shopping = shoppingSentence(snapshot.shopping);
  const focus = briefingFocus(question);
  const body =
    focus === "expiry" ? expiry : focus === "meals" ? meals : focus === "shopping" ? shopping : `${expiry} ${meals} ${shopping}`;
  return `${body} This is an estimate from the kitchen, not medical advice.`;
}

function snapshotKitchen(input: {
  items: ItemDraft[];
  useCounts: { itemId: string; count: number }[];
  recipes: Recipe[];
  today: string;
  dismissals?: { key: string; stockFingerprint: string }[];
}): { facts: KitchenFacts; expiring: { name: string; expiryDate: string }[]; meals: { advice: string }[]; shopping: { name: string; detail: string }[] } {
  const counts = new Map(input.useCounts.map((row) => [row.itemId, row.count]));
  const favorites = rankFavorites(
    input.items.map((item) => ({
      itemId: item.id,
      name: item.name,
      pinned: item.pinned,
      useCount30d: counts.get(item.id) ?? 0,
    })),
  );
  const soon = addDays(input.today, 3);
  const names = new Set<string>();
  const expiringNames = new Set<string>();
  const expiring: { name: string; expiryDate: string }[] = [];
  const stock: KitchenFacts["stock"] = [];
  for (const item of input.items) {
    const canon = canonicalName(item.name);
    const soonDates: string[] = [];
    for (const lot of item.lots) {
      if (lot.quantity <= 0 || !LOCATIONS.includes(lot.location)) continue;
      names.add(canon);
      stock.push({
        name: item.name,
        quantity: lot.quantity,
        unit: item.unit,
        location: lot.location,
        expiryDate: lot.expiryDate,
      });
      if (lot.expiryDate && lot.expiryDate >= input.today && lot.expiryDate <= soon) {
        expiringNames.add(canon);
        soonDates.push(lot.expiryDate);
      }
    }
    soonDates.sort();
    if (soonDates[0]) expiring.push({ name: item.name, expiryDate: soonDates[0] });
  }
  const scored = scoreRecipes(input.recipes, names, expiringNames);
  const fingerprint = stockFingerprint(input.items);
  const shopping = planShopping({
    items: input.items,
    favorites,
    scored,
    dismissals: input.dismissals ?? [],
    fingerprint,
  }).map((need) => ({ name: need.name, detail: need.detail }));
  const meals = selectMeals(scored).map((meal) => ({ advice: meal.advice }));
  return {
    facts: {
      stock,
      favorites: favorites.map((favorite) => ({ name: favorite.name, useCount: favorite.useCount })),
      recipes: input.recipes.map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        mealType: recipe.mealType,
        ingredients: recipe.ingredients.map((ingredient) => ingredient.name),
        nutrition: recipe.nutrition,
      })),
      shopping,
      expiring,
    },
    expiring,
    meals,
    shopping,
  };
}

export async function answerChat(input: {
  question: string;
  items: ItemDraft[];
  useCounts: { itemId: string; count: number }[];
  recipes: Recipe[];
  today: string;
  history: { role: ChatRole; body: string }[];
  model: KitchenChatModel | null;
  dismissals?: { key: string; stockFingerprint: string }[];
}): Promise<{ source: AdviceSource; reply: string }> {
  const snapshot = snapshotKitchen(input);
  const briefing = stripSecrets(localBriefing(input.question, snapshot));
  const fallback = (): { source: AdviceSource; reply: string } => ({ source: "matcher", reply: briefing });
  if (!input.model) return fallback();
  try {
    const draft = await input.model.reply({
      facts: snapshot.facts,
      history: input.history.slice(-CHAT_HISTORY_LIMIT),
      message: input.question,
    });
    const grounded = groundChatReply(draft, input.recipes);
    if (!grounded) return fallback();
    return { source: "model", reply: grounded };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Kitchen chat model failed; using matcher fallback.", redactValue(message));
    return fallback();
  }
}

export interface ChatThreadPorts {
  listItems(householdId: string): Promise<ItemDraft[]>;
  useCounts(householdId: string, since: Date): Promise<{ itemId: string; count: number }[]>;
  listDismissals(householdId: string): Promise<{ key: string; stockFingerprint: string }[]>;
  listChatTurns(householdId: string, userId: string): Promise<ChatTurn[]>;
  appendChatTurns(input: {
    householdId: string;
    userId: string;
    memberBody: string;
    pantryBody: string;
  }): Promise<{ member: ChatTurn; pantry: ChatTurn }>;
}

export async function sendKitchenChat(
  ports: ChatThreadPorts,
  input: {
    userId: string;
    householdId: string;
    text: string;
    today: string;
    recipes: Recipe[];
    model: KitchenChatModel | null;
  },
): Promise<{ source: AdviceSource; turns: ChatTurn[] }> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const text = stripSecrets(input.text);
  const [items, useCounts, dismissals, history] = await Promise.all([
    ports.listItems(input.householdId),
    ports.useCounts(input.householdId, since),
    ports.listDismissals(input.householdId),
    ports.listChatTurns(input.householdId, input.userId),
  ]);
  const answer = await answerChat({
    question: text,
    items,
    useCounts,
    recipes: input.recipes,
    today: input.today,
    history: history.map((turn) => ({ role: turn.role, body: turn.body })),
    model: input.model,
    dismissals,
  });
  const saved = await ports.appendChatTurns({
    householdId: input.householdId,
    userId: input.userId,
    memberBody: text,
    pantryBody: answer.reply,
  });
  return { source: answer.source, turns: [saved.member, saved.pantry] };
}
