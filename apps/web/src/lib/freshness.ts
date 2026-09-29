import type { Freshness, LocationName, PantryItem, StockLot } from "@smart-pantry/contracts";
import { formatDay, localToday } from "@/lib/api";

const ALL_LOCATIONS: LocationName[] = ["refrigerator", "freezer", "pantry"];

/** Worst-first so location status reflects the most urgent lot. */
const FRESHNESS_RANK: Record<Freshness, number> = {
  expired: 0,
  expiring: 1,
  fresh: 2,
  unknown: 3,
};

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayDiff(isoDate: string, today: string): number {
  const a = Date.parse(`${isoDate}T00:00:00.000Z`);
  const b = Date.parse(`${today}T00:00:00.000Z`);
  return Math.round((a - b) / 86_400_000);
}

export function freshnessOf(expiryDate: string | null, today: string): Freshness {
  if (!expiryDate) return "unknown";
  if (expiryDate < today) return "expired";
  if (expiryDate <= addDays(today, 3)) return "expiring";
  return "fresh";
}

export function lotsInLocation(item: PantryItem, location: LocationName): StockLot[] {
  return item.lots.filter((lot) => lot.location === location && lot.quantity > 0);
}

export function locationQuantity(lots: StockLot[]): number {
  const sum = lots.reduce((total, lot) => total + lot.quantity, 0);
  return Math.round(sum * 1000) / 1000;
}

export function locationFreshness(
  lots: StockLot[],
  today: string,
): { freshness: Freshness; nextExpiry: string | null } {
  const dated = lots.map((lot) => lot.expiryDate).filter((date): date is string => Boolean(date));
  if (dated.length === 0) return { freshness: "unknown", nextExpiry: null };

  const nextExpiry = [...dated].sort()[0] ?? null;
  let freshness: Freshness = "unknown";
  for (const lot of lots) {
    const next = freshnessOf(lot.expiryDate, today);
    if (FRESHNESS_RANK[next] < FRESHNESS_RANK[freshness]) freshness = next;
  }
  return { freshness, nextExpiry };
}

export function relativeExpiry(isoDate: string | null, today = localToday()): string {
  if (!isoDate) return "No date";
  const diff = dayDiff(isoDate, today);
  if (diff === 0) return "Expires today";
  if (diff === 1) return "Expires tomorrow";
  if (diff === -1) return "Expired yesterday";
  if (diff < 0) return `Expired ${Math.abs(diff)} days ago`;
  return `Expires in ${diff} days`;
}

export function expiryLine(isoDate: string | null, today = localToday()): string {
  if (!isoDate) return "No date";
  return `${relativeExpiry(isoDate, today)} · ${formatDay(isoDate)}`;
}

export function shortFreshness(freshness: Freshness): string {
  switch (freshness) {
    case "expired":
      return "Expired";
    case "expiring":
      return "Soon";
    case "fresh":
      return "Fresh";
    case "unknown":
      return "No date";
  }
}

export function elsewhereLine(item: PantryItem, location: LocationName): string | null {
  const parts: string[] = [];
  for (const entry of ALL_LOCATIONS) {
    if (entry === location) continue;
    const qty = locationQuantity(lotsInLocation(item, entry));
    if (qty <= 0) continue;
    parts.push(`${qty} ${item.unit} in the ${entry}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
