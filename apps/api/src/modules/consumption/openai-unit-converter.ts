import OpenAI from "openai";
import type { UnitConverter } from "./use-meal";

const SYSTEM = [
  "Convert a cooking recipe amount into the household stock unit.",
  "Return JSON with a single positive number field named quantity.",
  "Use ordinary kitchen conversions for the named ingredient.",
  "If the conversion is impossible, return quantity as null.",
  "Do not ask for or repeat API keys.",
].join(" ");

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    quantity: { type: ["number", "null"] },
  },
  required: ["quantity"],
} as const;

function readPositiveQuantity(text: string | null | undefined): number | null {
  if (!text) return null;
  const value = (JSON.parse(text) as { quantity?: number | null }).quantity;
  if (typeof value !== "number" || !Number.isFinite(value) || !(value > 0)) return null;
  return value;
}

export function createUnitConverter(env: NodeJS.ProcessEnv = process.env): UnitConverter | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const model = env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  return {
    async convert(input) {
      const completion = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: JSON.stringify({
                ingredient: input.ingredient,
                quantity: input.quantity,
                fromUnit: input.fromUnit,
                toUnit: input.toUnit,
              }),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "unit_conversion",
              strict: true,
              schema: RESPONSE_SCHEMA,
            },
          },
        },
        { signal: AbortSignal.timeout(10000) },
      );
      return readPositiveQuantity(completion.choices[0]?.message?.content);
    },
  };
}
