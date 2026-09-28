import type { Freshness, PantryItem } from "@smart-pantry/contracts";
import { addDays } from "../catalog/dates";
import type { LotDraft } from "./fifo";

export interface ItemDraft {
  id: string;
  householdId: string;
  name: string;
  unit: string;
  parLevel: number | null;
  pinned: boolean;
  lots: LotDraft[];
}

export function freshnessOf(expiryDate: string | null, today: string): Freshness {
  if (!expiryDate) return "unknown";
  if (expiryDate < today) return "expired";
  if (expiryDate <= addDays(today, 3)) return "expiring";
  return "fresh";
}

export function worstFreshness(lots: LotDraft[], today: string): { freshness: Freshness; nextExpiry: string | null } {
  const dated = lots.map((lot) => lot.expiryDate).filter((date): date is string => Boolean(date));
  if (dated.length === 0) return { freshness: lots.length ? "unknown" : "unknown", nextExpiry: null };
  const nextExpiry = [...dated].sort()[0] ?? null;
  const ranks: Freshness[] = lots.map((lot) => freshnessOf(lot.expiryDate, today));
  if (ranks.includes("expired")) return { freshness: "expired", nextExpiry };
  if (ranks.includes("expiring")) return { freshness: "expiring", nextExpiry };
  if (ranks.includes("fresh")) return { freshness: "fresh", nextExpiry };
  return { freshness: "unknown", nextExpiry };
}

export function toPantryItem(item: ItemDraft, today: string): PantryItem {
  const onHand = item.lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const { freshness, nextExpiry } = worstFreshness(item.lots, today);
  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    parLevel: item.parLevel,
    pinned: item.pinned,
    lots: item.lots,
    onHand: Math.round(onHand * 1000) / 1000,
    freshness,
    nextExpiry,
  };
}

export function isExpiringSoon(item: PantryItem, today: string): boolean {
  return item.lots.some((lot) => {
    if (!lot.expiryDate) return false;
    return lot.expiryDate >= today && lot.expiryDate <= addDays(today, 3);
  });
}
