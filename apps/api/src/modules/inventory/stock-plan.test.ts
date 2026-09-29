import { describe, expect, it } from "vitest";
import type { ItemDraft } from "./freshness";
import { planStockLine, type StockLineInput } from "./stock-plan";

function item(overrides: Partial<ItemDraft> & Pick<ItemDraft, "id" | "name">): ItemDraft {
  return {
    householdId: "hh-1",
    unit: "ea",
    category: "dairy",
    parLevel: null,
    pinned: false,
    lots: [],
    ...overrides,
  };
}

function line(overrides: Partial<StockLineInput> & Pick<StockLineInput, "name">): StockLineInput {
  return {
    unit: "ea",
    quantity: 1,
    location: "refrigerator",
    expiryDate: null,
    parLevel: null,
    category: "other",
    ...overrides,
  };
}

const milk = item({ id: "milk-1", name: "Milk", category: "dairy", parLevel: null });

describe("planStockLine", () => {
  it("creates when no Item matches the canonical name", () => {
    const plan = planStockLine(
      [milk],
      line({
        name: "Eggs",
        quantity: 12,
        expiryDate: "2026-10-01",
        parLevel: 6,
        category: "meat",
      }),
      { enrich: true },
    );
    expect(plan).toEqual({
      kind: "create",
      create: {
        name: "Eggs",
        unit: "ea",
        quantity: 12,
        location: "refrigerator",
        expiryDate: "2026-10-01",
        parLevel: 6,
        category: "meat",
      },
    });
  });

  it("merges on canonical alias match", () => {
    const plan = planStockLine(
      [item({ id: "egg-1", name: "Egg", category: "meat" })],
      line({ name: "Eggs", quantity: 6 }),
      { enrich: false },
    );
    expect(plan).toEqual({
      kind: "addLot",
      itemId: "egg-1",
      lot: { quantity: 6, location: "refrigerator", expiryDate: null },
    });
  });

  it("enrich true patches missing par and different category", () => {
    const plan = planStockLine(
      [milk],
      line({ name: "milk", unit: "L", parLevel: 2, category: "drinks" }),
      { enrich: true },
    );
    expect(plan).toEqual({
      kind: "addLotAndPatch",
      itemId: "milk-1",
      lot: { quantity: 1, location: "refrigerator", expiryDate: null },
      patch: { parLevel: 2, category: "drinks" },
    });
  });

  it("enrich true with no patch needed only adds a lot", () => {
    const plan = planStockLine(
      [item({ id: "milk-1", name: "Milk", category: "dairy", parLevel: 2 })],
      line({ name: "Milk", unit: "L", parLevel: 2, category: "dairy" }),
      { enrich: true },
    );
    expect(plan.kind).toBe("addLot");
  });

  it("enrich false never patches even when category would differ", () => {
    const plan = planStockLine(
      [milk],
      line({ name: "Milk", unit: "L", location: "pantry", parLevel: 4, category: "other" }),
      { enrich: false },
    );
    expect(plan).toEqual({
      kind: "addLot",
      itemId: "milk-1",
      lot: { quantity: 1, location: "pantry", expiryDate: null },
    });
  });

  it("intake create defaults are other category and null par", () => {
    const plan = planStockLine(
      [],
      line({ name: "Rice", unit: "kg", location: "pantry" }),
      { enrich: false },
    );
    expect(plan).toEqual({
      kind: "create",
      create: {
        name: "Rice",
        unit: "kg",
        quantity: 1,
        location: "pantry",
        expiryDate: null,
        parLevel: null,
        category: "other",
      },
    });
  });
});
