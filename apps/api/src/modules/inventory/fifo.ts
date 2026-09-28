import type { LocationName } from "@smart-pantry/contracts";

export interface LotDraft {
  id: string;
  location: LocationName;
  quantity: number;
  expiryDate: string | null;
}

export function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function consumeFifo(lots: LotDraft[], quantity: number): LotDraft[] {
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }
  const sorted = [...lots].sort((a, b) => {
    if (a.expiryDate === b.expiryDate) return a.id.localeCompare(b.id);
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return a.expiryDate.localeCompare(b.expiryDate);
  });
  let remaining = quantity;
  const next: LotDraft[] = [];
  for (const lot of sorted) {
    if (remaining <= 0) {
      next.push(lot);
      continue;
    }
    if (lot.quantity <= remaining + 1e-9) {
      remaining = roundQty(remaining - lot.quantity);
    } else {
      next.push({ ...lot, quantity: roundQty(lot.quantity - remaining) });
      remaining = 0;
    }
  }
  if (remaining > 1e-6) {
    throw new Error("Not enough stock.");
  }
  return next.filter((lot) => lot.quantity > 0);
}
