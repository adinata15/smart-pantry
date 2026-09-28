import type { ShoppingNeed, ShoppingReason } from "@smart-pantry/contracts";
import { canonicalName } from "../catalog/aliases";
import type { ScoredRecipe } from "../catalog/match";
import type { ItemDraft } from "../inventory/freshness";

export interface ShoppingDismissal {
  key: string;
  stockFingerprint: string;
}

export function stockFingerprint(items: ItemDraft[]): string {
  return items
    .flatMap((item) =>
      item.lots.map((lot) => `${item.id}:${lot.location}:${lot.quantity}:${lot.expiryDate ?? ""}`),
    )
    .sort()
    .join("|");
}

function pushNeed(needs: ShoppingNeed[], need: ShoppingNeed) {
  if (needs.some((existing) => existing.key === need.key)) return;
  needs.push(need);
}

export function planShopping(input: {
  items: ItemDraft[];
  favorites: { name: string; useCount: number; pinned: boolean }[];
  scored: ScoredRecipe[];
  dismissals: ShoppingDismissal[];
  fingerprint: string;
}): ShoppingNeed[] {
  const needs: ShoppingNeed[] = [];
  const favoriteNames = new Set(
    input.favorites.filter((favorite) => favorite.pinned || favorite.useCount >= 2).map((favorite) => canonicalName(favorite.name)),
  );

  for (const item of input.items) {
    const onHand = item.lots.reduce((sum, lot) => sum + lot.quantity, 0);
    const key = canonicalName(item.name);
    if (item.parLevel != null && onHand < item.parLevel) {
      pushNeed(needs, {
        key,
        name: item.name,
        reason: "below-par",
        detail: "On hand is below the par level.",
        suggestedQuantity: Math.max(1, Math.round((item.parLevel - onHand) * 1000) / 1000),
        unit: item.unit,
      });
      continue;
    }
    if (favoriteNames.has(key) && onHand <= 1 && (item.parLevel == null || onHand < item.parLevel)) {
      pushNeed(needs, {
        key,
        name: item.name,
        reason: "favorite-running-low",
        detail: "A favorite is running low.",
        suggestedQuantity: Math.max(1, Math.round((2 - onHand) * 1000) / 1000),
        unit: item.unit,
      });
    }
  }

  const owned = new Set(input.items.filter((item) => item.lots.some((lot) => lot.quantity > 0)).map((item) => canonicalName(item.name)));
  const near = input.scored.filter((row) => row.matchPercent >= 50 && row.missing.length > 0).slice(0, 3);
  for (const row of near) {
    for (const missing of row.missing) {
      const key = canonicalName(missing);
      if (owned.has(key)) continue;
      const ingredient = row.recipe.ingredients.find((entry) => canonicalName(entry.name) === key);
      pushNeed(needs, {
        key,
        name: missing,
        reason: "missing-ingredient",
        detail: `Needed for ${row.recipe.name}.`,
        suggestedQuantity: ingredient?.quantity ?? 1,
        unit: ingredient?.unit ?? "each",
      });
    }
  }

  const hidden = new Set(
    input.dismissals.filter((dismissal) => dismissal.stockFingerprint === input.fingerprint).map((dismissal) => dismissal.key),
  );
  const order: ShoppingReason[] = ["below-par", "favorite-running-low", "missing-ingredient"];
  return needs
    .filter((need) => !hidden.has(need.key))
    .sort((a, b) => order.indexOf(a.reason) - order.indexOf(b.reason) || a.name.localeCompare(b.name));
}

export function applyShoppingNotes(needs: ShoppingNeed[], notes: { name: string; note: string }[]): ShoppingNeed[] {
  return needs.map((need) => {
    const note = notes.find((entry) => canonicalName(entry.name) === need.key && entry.note.trim());
    if (!note) return need;
    return { ...need, detail: note.note.trim() };
  });
}
