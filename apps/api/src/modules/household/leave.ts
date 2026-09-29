import type { Role } from "@smart-pantry/contracts";
import { HttpError } from "../../infra/errors";

export type LeaveDecision =
  | { kind: "leave"; softDelete: boolean }
  | { kind: "promote_then_leave"; successorUserId: string; softDelete: false };

export function decideLeave(input: {
  role: Role;
  memberUserIds: string[];
  leaverUserId: string;
  successorUserId?: string;
}): LeaveDecision {
  const others = input.memberUserIds.filter((id) => id !== input.leaverUserId);
  const isLastMember = others.length === 0;

  if (input.role === "owner" && !isLastMember) {
    const successor = input.successorUserId?.trim();
    if (!successor) {
      throw new HttpError(409, "conflict", "Appoint a new owner before leaving this household.");
    }
    if (successor === input.leaverUserId) {
      throw new HttpError(400, "bad_request", "Choose another member as the new owner.");
    }
    if (!others.includes(successor)) {
      throw new HttpError(400, "bad_request", "That person is not a member of this household.");
    }
    return { kind: "promote_then_leave", successorUserId: successor, softDelete: false };
  }

  return { kind: "leave", softDelete: isLastMember };
}
