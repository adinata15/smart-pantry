import { describe, expect, it } from "vitest";
import type { Recipe } from "../catalog/recipes";
import type { ItemDraft } from "../inventory/freshness";
import {
  CHAT_HISTORY_LIMIT,
  answerChat,
  sendKitchenChat,
  type ChatThreadPorts,
  type KitchenChatModel,
} from "./chat";

const today = "2026-10-02";

const omelette: Recipe = {
  id: "veggie-omelette",
  name: "Veggie omelette",
  mealType: "breakfast",
  servings: 2,
  ingredients: [
    { name: "spinach", quantity: 1, unit: "cup" },
    { name: "egg", quantity: 2, unit: "each" },
  ],
  steps: ["Cook it."],
  nutrition: { calories: 280, protein: 19, carbs: 8, fat: 18, fiber: 2, sodium: 240 },
};

function spinach(): ItemDraft {
  return {
    id: "item-spinach",
    householdId: "hh",
    name: "Spinach",
    unit: "cup",
    category: "vegetable",
    parLevel: null,
    pinned: false,
    lots: [{ id: "lot-1", location: "refrigerator", quantity: 1, expiryDate: "2026-10-04" }],
  };
}

function ask(model: KitchenChatModel | null, question = "What expires soon?") {
  return answerChat({
    question,
    memberName: "Nata",
    items: [spinach()],
    useCounts: [],
    recipes: [omelette],
    today,
    history: [],
    model,
  });
}

function threadPorts(): ChatThreadPorts {
  return {
    listItems: async () => [spinach()],
    useCounts: async () => [],
    listDismissals: async () => [],
  };
}

describe("kitchen chat", () => {
  it("names an expiring item in the local briefing", async () => {
    const result = await ask(null);
    expect(result.source).toBe("matcher");
    expect(result.reply).toContain("Spinach");
  });

  it("falls back when a recipe id is unknown", async () => {
    const model: KitchenChatModel = {
      reply: async () => ({ reply: "Try the mystery dish.", recipeIds: ["not-a-recipe"] }),
    };
    const result = await ask(model);
    expect(result.source).toBe("matcher");
    expect(result.reply).toContain("Spinach");
    expect(result.reply).not.toContain("mystery");
  });

  it("falls back when a nutrition number is not in the catalog", async () => {
    const model: KitchenChatModel = {
      reply: async () => ({
        reply: "Veggie omelette has 999 calories.",
        recipeIds: ["veggie-omelette"],
      }),
    };
    const result = await ask(model);
    expect(result.source).toBe("matcher");
    expect(result.reply).not.toContain("999");
    expect(result.reply).toContain("Spinach");
  });

  it("keeps a reply that cites a real recipe and its catalog nutrition", async () => {
    const model: KitchenChatModel = {
      reply: async () => ({
        reply: "Veggie omelette has 280 calories. This is an estimate, not medical advice.",
        recipeIds: ["veggie-omelette"],
      }),
    };
    const result = await ask(model);
    expect(result.source).toBe("model");
    expect(result.reply).toContain("Veggie omelette");
    expect(result.reply).toContain("280 calories");
  });

  it("sends only the latest turns to the model", async () => {
    let seen = 0;
    const model: KitchenChatModel = {
      reply: async (input) => {
        seen = input.history.length;
        return { reply: "Use the spinach soon.", recipeIds: [] };
      },
    };
    const history = Array.from({ length: CHAT_HISTORY_LIMIT + 5 }, (_, index) => ({
      role: index % 2 === 0 ? ("member" as const) : ("pantry" as const),
      body: `turn ${index}`,
    }));
    const result = await answerChat({
      question: "Hello",
      memberName: "Nata",
      items: [],
      useCounts: [],
      recipes: [],
      today,
      history,
      model,
    });
    expect(seen).toBe(CHAT_HISTORY_LIMIT);
    expect(result.source).toBe("model");
  });

  it("passes the member's display name and kitchen facts without an email", async () => {
    let payload = "";
    const model: KitchenChatModel = {
      reply: async (input) => {
        payload = JSON.stringify(input);
        return { reply: "Use the spinach soon.", recipeIds: [] };
      },
    };
    const result = await ask(model);
    const parsed = JSON.parse(payload) as { memberName: string; facts: { stock: unknown[] } };
    expect(parsed.memberName).toBe("Nata");
    expect(parsed.facts.stock.length).toBeGreaterThan(0);
    expect(payload).not.toMatch(/email/i);
    expect(payload).not.toContain("@");
    expect(result.source).toBe("model");
  });

  it("answers from the history it was given and does not keep a thread", async () => {
    const seen: { memberName: string; history: string[] }[] = [];
    const model: KitchenChatModel = {
      reply: async (input) => {
        seen.push({ memberName: input.memberName, history: input.history.map((turn) => turn.body) });
        return { reply: "Use the spinach soon.", recipeIds: [] };
      },
    };
    const history = Array.from({ length: CHAT_HISTORY_LIMIT + 5 }, (_, index) => ({
      role: index % 2 === 0 ? ("member" as const) : ("pantry" as const),
      body: `turn ${index}`,
    }));
    const first = await sendKitchenChat(threadPorts(), {
      householdId: "hh",
      memberName: "Ada",
      text: "What expires soon?",
      today,
      recipes: [omelette],
      history,
      model,
    });
    const second = await sendKitchenChat(threadPorts(), {
      householdId: "hh",
      memberName: "Bea",
      text: "What should we buy?",
      today,
      recipes: [omelette],
      history: [{ role: "member", body: "only bea" }],
      model,
    });
    expect(seen[0]?.memberName).toBe("Ada");
    expect(seen[0]?.history).toHaveLength(CHAT_HISTORY_LIMIT);
    expect(seen[0]?.history[0]).toBe("turn 5");
    expect(seen[1]).toEqual({ memberName: "Bea", history: ["only bea"] });
    expect(first.turns.map((turn) => turn.role)).toEqual(["member", "pantry"]);
    expect(first.turns[0]?.body).toBe("What expires soon?");
    expect(second.turns[0]?.body).toBe("What should we buy?");
    expect(first.turns[0]?.id).not.toBe(second.turns[0]?.id);
  });
});
