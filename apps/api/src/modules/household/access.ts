import type { Role } from "@smart-pantry/contracts";
import { HttpError } from "../../infra/errors";

export function assertMembership(membership: { role: Role } | null): { role: Role } {
  if (!membership) {
    throw new HttpError(403, "forbidden", "You are not a member of this household.");
  }
  return membership;
}

export function itemsForHousehold<T extends { householdId: string }>(rows: T[], householdId: string): T[] {
  return rows.filter((row) => row.householdId === householdId);
}
