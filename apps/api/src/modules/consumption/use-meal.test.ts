import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../infra/errors";
import type { Recipe } from "../catalog/recipes";
import type { ItemDraft } from "../inventory/freshness";
import type { MealUsePorts, UnitConverter } from "./use-meal";
import { useMeal } from "./use-meal";
import { unitsMatch } from "./units";

function unused(): never {
  throw new Error("unused");
}

function recipe(ingredients: Recipe["ingredients"]): Recipe {
  return {
    id: "test-meal",
    name: "Test meal",
    mealType: "dinner",
    servings: 2,
    steps: ["Cook."],
    nutrition: { calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 0, sodium: 0 },
    ingredients,
  };
}

function item(partial: Partial<ItemDraft> & Pick<ItemDraft, "id" | "name" | "unit" | "lots">): ItemDraft {
  return {
    householdId: "house-a",
    parLevel: null,
    pinned: false,
    ...partial,
  };
}

function stubPorts(listItems: ItemDraft[], saveMealConsumption = vi.fn(async () => undefined)) {
  const ports: MealUsePorts = {
    membership: async () => ({ role: "owner" }),
    listItems: async () => listItems,
    createItem: async () => unused(),
    updateItem: async () => unused(),
    addLot: async () => unused(),
    updateLot: async () => unused(),
    saveConsumption: async () => unused(),
    saveMealConsumption,
  };
  return { ports, saveMealConsumption };
}

const eggs = () =>
  item({
    id: "egg",
    name: "Eggs",
    unit: "each",
    lots: [{ id: "lot-egg", location: "refrigerator", quantity: 6, expiryDate: "2026-10-01" }],
  });

const spinach = () =>
  item({
    id: "spinach",
    name: "Spinach",
    unit: "cup",
    lots: [{ id: "lot-spin", location: "refrigerator", quantity: 2, expiryDate: null }],
  });

const milk = (quantity = 1) =>
  item({
    id: "milk",
    name: "Milk",
    unit: "L",
    lots: [{ id: "lot-milk", location: "refrigerator", quantity, expiryDate: null }],
  });

describe("unitsMatch", () => {
  it("treats tablespoon aliases as the same unit", () => {
    expect(unitsMatch("tbsp", "tablespoon")).toBe(true);
    expect(unitsMatch("tbsp", "ml")).toBe(false);
  });
});

describe("useMeal", () => {
  it("commits when every ingredient matches the stock unit", async () => {
    const { ports, saveMealConsumption } = stubPorts([eggs(), spinach()]);
    const result = await useMeal(ports, null, {
      userId: "user-a",
      householdId: "house-a",
      recipe: recipe([
        { name: "egg", quantity: 3, unit: "each" },
        { name: "spinach", quantity: 1, unit: "cup" },
      ]),
    });
    expect(result).toEqual({ status: "used" });
    expect(saveMealConsumption).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: "house-a",
        userId: "user-a",
        lines: expect.arrayContaining([
          expect.objectContaining({ itemId: "egg", quantity: 3 }),
          expect.objectContaining({ itemId: "spinach", quantity: 1 }),
        ]),
      }),
    );
  });

  it("refuses when an ingredient is missing and writes nothing", async () => {
    const { ports, saveMealConsumption } = stubPorts([eggs()]);
    await expect(
      useMeal(ports, null, {
        userId: "user-a",
        householdId: "house-a",
        recipe: recipe([
          { name: "egg", quantity: 2, unit: "each" },
          { name: "milk", quantity: 1, unit: "cup" },
        ]),
      }),
    ).rejects.toMatchObject({ code: "missing_ingredients" } satisfies Partial<HttpError>);
    expect(saveMealConsumption).not.toHaveBeenCalled();
  });

  it("asks for confirmation when units differ even after a conversion", async () => {
    const { ports, saveMealConsumption } = stubPorts([milk()]);
    const converter: UnitConverter = { convert: async () => 0.03 };
    const result = await useMeal(ports, converter, {
      userId: "user-a",
      householdId: "house-a",
      recipe: recipe([{ name: "milk", quantity: 2, unit: "tbsp" }]),
    });
    expect(result).toEqual({
      status: "needs-quantity",
      lines: [{ ingredient: "milk", unit: "L", onHand: 1, suggested: 0.03 }],
    });
    expect(saveMealConsumption).not.toHaveBeenCalled();
  });

  it("asks for a typed amount when conversion fails", async () => {
    const { ports, saveMealConsumption } = stubPorts([milk()]);
    const converter: UnitConverter = { convert: async () => null };
    const result = await useMeal(ports, converter, {
      userId: "user-a",
      householdId: "house-a",
      recipe: recipe([{ name: "milk", quantity: 2, unit: "tbsp" }]),
    });
    expect(result).toEqual({
      status: "needs-quantity",
      lines: [{ ingredient: "milk", unit: "L", onHand: 1, suggested: null }],
    });
    expect(saveMealConsumption).not.toHaveBeenCalled();
  });

  it("commits after the member confirms a converted amount", async () => {
    const { ports, saveMealConsumption } = stubPorts([eggs(), milk()]);
    const converter: UnitConverter = {
      convert: async () => {
        throw new Error("should not convert when confirmed");
      },
    };
    const result = await useMeal(ports, converter, {
      userId: "user-a",
      householdId: "house-a",
      recipe: recipe([
        { name: "egg", quantity: 2, unit: "each" },
        { name: "milk", quantity: 2, unit: "tbsp" },
      ]),
      quantities: [{ ingredient: "milk", quantity: 0.03 }],
    });
    expect(result).toEqual({ status: "used" });
    expect(saveMealConsumption).toHaveBeenCalledOnce();
  });

  it("returns needs-quantity when confirmed stock is short", async () => {
    const { ports, saveMealConsumption } = stubPorts([milk(0.01)]);
    const result = await useMeal(ports, null, {
      userId: "user-a",
      householdId: "house-a",
      recipe: recipe([{ name: "milk", quantity: 2, unit: "tbsp" }]),
      quantities: [{ ingredient: "milk", quantity: 0.5 }],
    });
    expect(result.status).toBe("needs-quantity");
    expect(saveMealConsumption).not.toHaveBeenCalled();
  });
});
