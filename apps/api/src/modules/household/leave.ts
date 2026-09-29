import type { Role } from "@smart-pantry/contracts";
import { HttpError } from "../../infra/errors";

export type LeaveDecision =
  | { kind: "leave"; softDelete: boolean }
  | { kind: "promote_then_leave"; successorUserId: string; softDelete: false };

export type LeavePlan = {
  userId: string;
  householdId: string;
  promoteUserId?: string;
  softDelete: boolean;
};

export type LeaveContext = {
  householdId: string;
  role: Role;
  memberUserIds: string[];
};

export interface LeavePorts {
  loadLeaveContext(input: { userId: string; householdId: string }): Promise<LeaveContext>;
  applyLeave(plan: LeavePlan): Promise<void>;
}

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

export function buildLeavePlan(
  context: LeaveContext,
  userId: string,
  successorUserId?: string,
): LeavePlan {
  const decision = decideLeave({
    role: context.role,
    memberUserIds: context.memberUserIds,
    leaverUserId: userId,
    successorUserId,
  });

  return {
    userId,
    householdId: context.householdId,
    promoteUserId: decision.kind === "promote_then_leave" ? decision.successorUserId : undefined,
    softDelete: decision.softDelete,
  };
}

export async function leaveHousehold(
  ports: LeavePorts,
  input: { userId: string; householdId: string; successorUserId?: string },
): Promise<void> {
  const context = await ports.loadLeaveContext({
    userId: input.userId,
    householdId: input.householdId,
  });
  const plan = buildLeavePlan(context, input.userId, input.successorUserId);
  await ports.applyLeave(plan);
}
