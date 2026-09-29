import type { AddLotRequest, CreateItemRequest, LocationName, Role, UpdateItemRequest, UpdateLotRequest } from "@smart-pantry/contracts";
import { HttpError } from "../../infra/errors";
import { canonicalName } from "../catalog/aliases";
import { assertMembership } from "../household/access";
import { consumeFifo } from "./fifo";
import type { ItemDraft } from "./freshness";

export interface InventoryPorts {
  membership(userId: string, householdId: string): Promise<{ role: Role } | null>;
  listItems(householdId: string): Promise<ItemDraft[]>;
  createItem(householdId: string, input: CreateItemRequest): Promise<ItemDraft>;
  updateItem(householdId: string, itemId: string, input: UpdateItemRequest): Promise<ItemDraft>;
  addLot(householdId: string, itemId: string, input: AddLotRequest): Promise<ItemDraft>;
  updateLot(householdId: string, lotId: string, input: UpdateLotRequest): Promise<ItemDraft>;
  saveConsumption(input: {
    householdId: string;
    itemId: string;
    userId: string;
    quantity: number;
    lots: ItemDraft["lots"];
  }): Promise<ItemDraft>;
  saveMealConsumption(input: {
    householdId: string;
    userId: string;
    lines: { itemId: string; quantity: number; lots: ItemDraft["lots"] }[];
  }): Promise<void>;
}

async function gate(ports: InventoryPorts, userId: string, householdId: string) {
  assertMembership(await ports.membership(userId, householdId));
}

export async function readHouseholdItems(ports: InventoryPorts, userId: string, householdId: string) {
  await gate(ports, userId, householdId);
  return ports.listItems(householdId);
}

export async function addStock(ports: InventoryPorts, userId: string, householdId: string, input: CreateItemRequest) {
  await gate(ports, userId, householdId);
  const items = await ports.listItems(householdId);
  const existing = items.find((item) => canonicalName(item.name) === canonicalName(input.name));
  if (existing) {
    if (input.parLevel != null && existing.parLevel == null) {
      await ports.updateItem(householdId, existing.id, { parLevel: input.parLevel });
    }
    return ports.addLot(householdId, existing.id, {
      quantity: input.quantity,
      location: input.location,
      expiryDate: input.expiryDate,
    });
  }
  return ports.createItem(householdId, input);
}

export async function editItem(
  ports: InventoryPorts,
  userId: string,
  householdId: string,
  itemId: string,
  input: UpdateItemRequest,
) {
  await gate(ports, userId, householdId);
  return ports.updateItem(householdId, itemId, input);
}

export async function editLot(
  ports: InventoryPorts,
  userId: string,
  householdId: string,
  lotId: string,
  input: UpdateLotRequest,
) {
  await gate(ports, userId, householdId);
  return ports.updateLot(householdId, lotId, input);
}

export async function addLotToItem(
  ports: InventoryPorts,
  userId: string,
  householdId: string,
  itemId: string,
  input: AddLotRequest,
) {
  await gate(ports, userId, householdId);
  return ports.addLot(householdId, itemId, input);
}

export async function useItem(
  ports: InventoryPorts,
  userId: string,
  householdId: string,
  itemId: string,
  quantity: number,
) {
  await gate(ports, userId, householdId);
  const items = await ports.listItems(householdId);
  const item = items.find((entry) => entry.id === itemId);
  if (!item) throw new HttpError(404, "not_found", "That item is not in this household.");
  let lots;
  try {
    lots = consumeFifo(item.lots, quantity);
  } catch {
    throw new HttpError(400, "insufficient_stock", "There is not enough of that item to use.");
  }
  return ports.saveConsumption({ householdId, itemId, userId, quantity, lots });
}

export function lotsIn(item: ItemDraft, location?: LocationName) {
  if (!location) return item.lots;
  return item.lots.filter((lot) => lot.location === location);
}
