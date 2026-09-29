import type {
  AddLotRequest,
  CreateItemRequest,
  UpdateItemRequest,
} from "@smart-pantry/contracts";
import { canonicalName } from "../catalog/aliases";
import type { ItemDraft } from "./freshness";

/** One stock line to merge — same shape as fridge create / intake create. */
export type StockLineInput = CreateItemRequest;

export type StockPlanDecision =
  | { kind: "create"; create: CreateItemRequest }
  | { kind: "addLot"; itemId: string; lot: AddLotRequest }
  | { kind: "addLotAndPatch"; itemId: string; lot: AddLotRequest; patch: UpdateItemRequest };

function lotFrom(input: StockLineInput): AddLotRequest {
  return {
    quantity: input.quantity,
    location: input.location,
    expiryDate: input.expiryDate,
  };
}

function enrichPatch(existing: ItemDraft, input: StockLineInput): UpdateItemRequest | null {
  const patch: UpdateItemRequest = {};
  if (input.parLevel != null && existing.parLevel == null) patch.parLevel = input.parLevel;
  if (input.category !== existing.category) patch.category = input.category;
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Decide how one stock line merges into known Items. Callers apply the decision. */
export function planStockLine(
  known: ItemDraft[],
  input: StockLineInput,
  options: { enrich: boolean },
): StockPlanDecision {
  const existing = known.find((item) => canonicalName(item.name) === canonicalName(input.name));
  if (!existing) return { kind: "create", create: { ...input } };

  const lot = lotFrom(input);
  if (options.enrich) {
    const patch = enrichPatch(existing, input);
    if (patch) return { kind: "addLotAndPatch", itemId: existing.id, lot, patch };
  }
  return { kind: "addLot", itemId: existing.id, lot };
}
