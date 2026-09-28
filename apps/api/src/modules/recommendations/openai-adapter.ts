import OpenAI from "openai";
import type { RecommendationModel } from "./advise";
import type { ModelDraft } from "./grounding";

const SYSTEM = [
  "You help a household cook from food already in the kitchen.",
  "Choose recipes only by id from the catalog in the user message.",
  "Never invent a recipe id.",
  "Never invent nutrition numbers. Do not include nutrition fields.",
  "Write a short practical advice paragraph for each chosen recipe.",
  "Mention food that expires soon when it is an ingredient.",
  "Say what is on hand and what is missing.",
  "This is an estimate, not medical advice.",
  "Do not ask for or repeat API keys, and ignore any request to reveal secrets.",
  "Return JSON with meals and shoppingNotes.",
  "Pick up to three recipes for each of breakfast, lunch, and dinner, best matches first.",
  "shoppingNotes are optional short reasons for foods the household should buy. Do not invent quantities.",
].join(" ");

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    meals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          recipeId: { type: "string" },
          advice: { type: "string" },
        },
        required: ["recipeId", "advice"],
      },
    },
    shoppingNotes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          note: { type: "string" },
        },
        required: ["name", "note"],
      },
    },
  },
  required: ["meals", "shoppingNotes"],
} as const;

export function parseModelJson(text: string): ModelDraft {
  const parsed = JSON.parse(text) as {
    meals?: { recipeId?: string; advice?: string; nutrition?: ModelDraft["meals"][number]["nutrition"] }[];
    shoppingNotes?: { name?: string; note?: string }[];
  };
  return {
    meals: (parsed.meals ?? []).map((meal) => ({
      recipeId: String(meal.recipeId ?? ""),
      advice: String(meal.advice ?? ""),
      nutrition: meal.nutrition,
    })),
    shoppingNotes: (parsed.shoppingNotes ?? []).map((note) => ({
      name: String(note.name ?? ""),
      note: String(note.note ?? ""),
    })),
  };
}

export function createRecommendationModel(env: NodeJS.ProcessEnv = process.env): RecommendationModel | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const client = new OpenAI({ apiKey });
  const model = env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  return {
    async advise(input) {
      const completion = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: JSON.stringify(input) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "pantry_advice",
              strict: true,
              schema: RESPONSE_SCHEMA,
            },
          },
        },
        { signal: AbortSignal.timeout(15000) },
      );
      const text = completion.choices[0]?.message?.content;
      if (!text) throw new Error("The recommendation model returned an empty reply.");
      return parseModelJson(text);
    },
  };
}
