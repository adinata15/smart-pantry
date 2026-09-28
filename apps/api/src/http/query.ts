import type { LocationName } from "@smart-pantry/contracts";
import { isIsoDate, todayIso } from "../modules/catalog/dates";

export function readToday(query: unknown): string {
  if (query && typeof query === "object" && "today" in query) {
    const today = String((query as { today?: unknown }).today ?? "");
    if (isIsoDate(today)) return today;
  }
  return todayIso();
}

const ALL_LOCATIONS: LocationName[] = ["refrigerator", "freezer", "pantry"];

export function readLocations(query: unknown): LocationName[] {
  if (query && typeof query === "object" && "locations" in query) {
    const value = String((query as { locations?: unknown }).locations ?? "");
    if (value === "all") return [...ALL_LOCATIONS];
  }
  return [...ALL_LOCATIONS];
}
