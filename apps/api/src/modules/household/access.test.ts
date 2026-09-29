import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../infra/errors";
import type { ItemDraft } from "../inventory/freshness";
import { readHouseholdItems, type InventoryPorts } from "../inventory/use-cases";
import { assertMembership, itemsForHousehold } from "./access";

function unused(): never {
  throw new Error("unused");
}

function stubPorts(partial: Pick<InventoryPorts, "membership" | "listItems">): InventoryPorts {
  return {
    createItem: async () => unused(),
    updateItem: async () => unused(),
    addLot: async () => unused(),
    updateLot: async () => unused(),
    saveConsumption: async () => unused(),
    saveMealConsumption: async () => unused(),
    ...partial,
  };
}

function draft(partial: Pick<ItemDraft, "id" | "householdId" | "name">): ItemDraft {
  return {
    unit: "each",
    parLevel: null,
    pinned: false,
    lots: [],
    ...partial,
  };
}

describe("household isolation", () => {
  it("refuses a person who is not a member", async () => {
    const listItems = vi.fn(async () => []);
    await expect(
      readHouseholdItems(
        stubPorts({
          membership: async () => null,
          listItems,
        }),
        "user-b",
        "house-a",
      ),
    ).rejects.toBeInstanceOf(HttpError);
    expect(listItems).not.toHaveBeenCalled();
  });

  it("returns only the requested household's items", async () => {
    const rows = [draft({ id: "milk", householdId: "house-a", name: "Milk" }), draft({ id: "steak", householdId: "house-b", name: "Steak" })];
    const items = await readHouseholdItems(
      stubPorts({
        membership: async (userId, householdId) =>
          userId === "user-a" && householdId === "house-a" ? { role: "owner" } : null,
        listItems: async (householdId) => itemsForHousehold(rows, householdId),
      }),
      "user-a",
      "house-a",
    );
    expect(items.map((item) => item.name)).toEqual(["Milk"]);
  });

  it("does not treat membership in one household as access to another", () => {
    expect(() => assertMembership(null)).toThrow(/not a member/);
  });
});
