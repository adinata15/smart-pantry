import type { ItemCategory } from "@smart-pantry/contracts";
import {
  Basket,
  Bread,
  Carrot,
  Coffee,
  Egg,
  Fish,
  ForkKnife,
  Jar,
  Orange,
  Package,
} from "@phosphor-icons/react";
import type { ComponentType, SVGProps } from "react";

type CategoryIcon = ComponentType<SVGProps<SVGSVGElement> & { weight?: "regular" | "fill" }>;

export type CategoryOption = { id: ItemCategory; label: string; Icon: CategoryIcon };

export const categoryOptions: CategoryOption[] = [
  { id: "vegetable", label: "Vegetable", Icon: Carrot },
  { id: "fruits", label: "Fruits", Icon: Orange },
  { id: "dairy", label: "Dairy & eggs", Icon: Egg },
  { id: "meat", label: "Meat & seafood", Icon: Fish },
  { id: "bakery", label: "Bakery", Icon: Bread },
  { id: "drinks", label: "Drinks", Icon: Coffee },
  { id: "condiments", label: "Condiments", Icon: Jar },
  { id: "leftovers", label: "Leftovers", Icon: ForkKnife },
  { id: "dry-goods", label: "Dry goods", Icon: Package },
  { id: "other", label: "Other", Icon: Basket },
];

const categoryById = Object.fromEntries(
  categoryOptions.map((option) => [option.id, option]),
) as Record<ItemCategory, CategoryOption>;

export function categoryMeta(category: ItemCategory): CategoryOption {
  return categoryById[category] ?? categoryById.other;
}
