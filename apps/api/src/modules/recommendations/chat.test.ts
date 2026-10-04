import type { ChatTurn } from "@smart-pantry/contracts";
import { describe, expect, it } from "vitest";
import type { Recipe } from "../catalog/recipes";
import type { ItemDraft } from "../inventory/freshness";
import {
  CHAT_HISTORY_LIMIT,
  answerChat,
  chatTurnWhere,
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
    items: [spinach()],
    useCounts: [],
    recipes: [omelette],
    today,
    history: [],
    model,
  });
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

  it("loads and writes turns only for the asking member", async () => {
    type Row = ChatTurn & { householdId: string; userId: string };
    const rows: Row[] = [];
    let nextId = 0;
    const ports: ChatThreadPorts = {
      listItems: async () => [spinach()],
      useCounts: async () => [],
      listDismissals: async () => [],
      async listChatTurns(householdId, userId) {
        const where = chatTurnWhere(householdId, userId);
        return rows
          .filter((row) => row.householdId === where.householdId && row.userId === where.userId)
          .map(({ id, role, body, createdAt }) => ({ id, role, body, createdAt }));
      },
      async appendChatTurns(input) {
        const member: Row = {
          id: `turn-${nextId++}`,
          householdId: input.householdId,
          userId: input.userId,
          role: "member",
          body: input.memberBody,
          createdAt: new Date().toISOString(),
        };
        const pantry: Row = {
          id: `turn-${nextId++}`,
          householdId: input.householdId,
          userId: input.userId,
          role: "pantry",
          body: input.pantryBody,
          createdAt: new Date(Date.now() + 1).toISOString(),
        };
        rows.push(member, pantry);
        return { member, pantry };
      },
    };

    await sendKitchenChat(ports, {
      userId: "member-a",
      householdId: "hh",
      text: "What expires soon?",
      today,
      recipes: [omelette],
      model: null,
    });
    await sendKitchenChat(ports, {
      userId: "member-b",
      householdId: "hh",
      text: "What should we buy?",
      today,
      recipes: [omelette],
      model: null,
    });

    const visible = await ports.listChatTurns("hh", "member-a");
    expect(visible.map((turn) => turn.body)).toContain("What expires soon?");
    expect(visible.some((turn) => turn.body.includes("What should we buy?"))).toBe(false);
    expect(rows.filter((row) => row.userId === "member-a")).toHaveLength(2);
    expect(rows.filter((row) => row.userId === "member-b").every((row) => row.userId === "member-b")).toBe(true);
  });
});
