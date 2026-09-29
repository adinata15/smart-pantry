import type { MealUseQuantity, MealUseQuantityLine, UseMealResponse } from "@smart-pantry/contracts";
import { HttpError } from "../../infra/errors";
import { canonicalName } from "../catalog/aliases";
import type { Recipe } from "../catalog/recipes";
import { assertMembership } from "../household/access";
import { consumeFifo, roundQty } from "../inventory/fifo";
import type { ItemDraft } from "../inventory/freshness";
import type { InventoryPorts } from "../inventory/use-cases";
import { unitsMatch } from "./units";

export interface UnitConverter {
  convert(input: {
    quantity: number;
    fromUnit: string;
    toUnit: string;
    ingredient: string;
  }): Promise<number | null>;
}

export type MealUsePorts = InventoryPorts;

function onHand(item: ItemDraft): number {
  return item.lots.reduce((sum, lot) => sum + lot.quantity, 0);
}

function findStockedItem(items: ItemDraft[], ingredientName: string): ItemDraft | undefined {
  const target = canonicalName(ingredientName);
  return items.find((item) => canonicalName(item.name) === target && onHand(item) > 0);
}

function quantityLine(
  ingredient: string,
  item: ItemDraft,
  suggested: number | null,
): MealUseQuantityLine {
  return {
    ingredient,
    unit: item.unit,
    onHand: onHand(item),
    suggested,
  };
}

function sanitizeSuggested(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || !(value > 0)) return null;
  return roundQty(value);
}

async function suggestConvertedQty(
  converter: UnitConverter | null,
  ingredient: Recipe["ingredients"][number],
  stockUnit: string,
): Promise<number | null> {
  if (!converter) return null;
  try {
    return sanitizeSuggested(
      await converter.convert({
        quantity: ingredient.quantity,
        fromUnit: ingredient.unit,
        toUnit: stockUnit,
        ingredient: ingredient.name,
      }),
    );
  } catch {
    return null;
  }
}

/** Same unit → recipe qty. Confirmed → member qty. Different unit → always ask (optional suggestion). */
async function resolveQty(input: {
  ingredient: Recipe["ingredients"][number];
  item: ItemDraft;
  confirmed: Map<string, number>;
  converter: UnitConverter | null;
}): Promise<{ quantity: number } | { ask: true; suggested: number | null }> {
  const { ingredient, item, confirmed, converter } = input;
  const confirmedQty = confirmed.get(canonicalName(ingredient.name));

  if (confirmedQty != null) {
    if (!(confirmedQty > 0)) return { ask: true, suggested: null };
    return { quantity: confirmedQty };
  }

  if (unitsMatch(ingredient.unit, item.unit)) {
    return { quantity: ingredient.quantity };
  }

  return {
    ask: true,
    suggested: await suggestConvertedQty(converter, ingredient, item.unit),
  };
}

export async function useMeal(
  ports: MealUsePorts,
  converter: UnitConverter | null,
  input: {
    userId: string;
    householdId: string;
    recipe: Recipe;
    quantities?: MealUseQuantity[];
  },
): Promise<UseMealResponse> {
  assertMembership(await ports.membership(input.userId, input.householdId));

  const items = await ports.listItems(input.householdId);
  const confirmed = new Map(
    (input.quantities ?? []).map((row) => [canonicalName(row.ingredient), roundQty(row.quantity)]),
  );

  const missingNames: string[] = [];
  const ready: { itemId: string; quantity: number; lots: ItemDraft["lots"] }[] = [];
  const needsQuantity: MealUseQuantityLine[] = [];

  for (const ingredient of input.recipe.ingredients) {
    const item = findStockedItem(items, ingredient.name);
    if (!item) {
      missingNames.push(ingredient.name);
      continue;
    }

    const resolved = await resolveQty({ ingredient, item, confirmed, converter });
    if ("ask" in resolved) {
      needsQuantity.push(quantityLine(ingredient.name, item, resolved.suggested));
      continue;
    }

    const { quantity } = resolved;
    const hand = onHand(item);
    if (quantity > hand + 1e-9) {
      needsQuantity.push(quantityLine(ingredient.name, item, quantity));
      continue;
    }

    try {
      ready.push({
        itemId: item.id,
        quantity,
        lots: consumeFifo(item.lots, quantity),
      });
    } catch {
      needsQuantity.push(quantityLine(ingredient.name, item, quantity));
    }
  }

  if (missingNames.length > 0) {
    throw new HttpError(
      400,
      "missing_ingredients",
      `Every ingredient must be on hand. Still missing: ${missingNames.join(", ")}.`,
    );
  }

  if (needsQuantity.length > 0) {
    return { status: "needs-quantity", lines: needsQuantity };
  }

  await ports.saveMealConsumption({
    householdId: input.householdId,
    userId: input.userId,
    lines: ready,
  });

  return { status: "used" };
}
