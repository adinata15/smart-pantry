import type { Favorite } from "@smart-pantry/contracts";

export interface FavoriteInput {
  itemId: string;
  name: string;
  pinned: boolean;
  useCount30d: number;
}

export function rankFavorites(items: FavoriteInput[]): Favorite[] {
  return items
    .filter((item) => item.pinned || item.useCount30d >= 2)
    .sort((a, b) => b.useCount30d - a.useCount30d || a.name.localeCompare(b.name))
    .map((item) => ({
      itemId: item.itemId,
      name: item.name,
      useCount: item.useCount30d,
      pinned: item.pinned,
    }));
}
