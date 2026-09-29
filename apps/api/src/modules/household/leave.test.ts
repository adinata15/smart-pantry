import { describe, expect, it } from "vitest";
import { HttpError } from "../../infra/errors";
import {
  buildLeavePlan,
  decideLeave,
  leaveHousehold,
  type LeaveContext,
  type LeavePlan,
  type LeavePorts,
} from "./leave";

describe("decideLeave", () => {
  it("requires a successor when an owner leaves other members behind", () => {
    expect(() =>
      decideLeave({
        role: "owner",
        memberUserIds: ["owner-a", "member-b"],
        leaverUserId: "owner-a",
      }),
    ).toThrow(HttpError);
    expect(() =>
      decideLeave({
        role: "owner",
        memberUserIds: ["owner-a", "member-b"],
        leaverUserId: "owner-a",
      }),
    ).toThrow(/Appoint a new owner/);
  });

  it("promotes the chosen successor before the owner leaves", () => {
    expect(
      decideLeave({
        role: "owner",
        memberUserIds: ["owner-a", "member-b", "member-c"],
        leaverUserId: "owner-a",
        successorUserId: "member-b",
      }),
    ).toEqual({
      kind: "promote_then_leave",
      successorUserId: "member-b",
      softDelete: false,
    });
  });

  it("rejects a successor who is not another member", () => {
    expect(() =>
      decideLeave({
        role: "owner",
        memberUserIds: ["owner-a", "member-b"],
        leaverUserId: "owner-a",
        successorUserId: "owner-a",
      }),
    ).toThrow(/another member/);

    expect(() =>
      decideLeave({
        role: "owner",
        memberUserIds: ["owner-a", "member-b"],
        leaverUserId: "owner-a",
        successorUserId: "stranger",
      }),
    ).toThrow(/not a member/);
  });

  it("soft-deletes when the last member leaves", () => {
    expect(
      decideLeave({
        role: "owner",
        memberUserIds: ["solo"],
        leaverUserId: "solo",
      }),
    ).toEqual({ kind: "leave", softDelete: true });

    expect(
      decideLeave({
        role: "member",
        memberUserIds: ["solo"],
        leaverUserId: "solo",
      }),
    ).toEqual({ kind: "leave", softDelete: true });
  });

  it("lets a non-owner leave without a successor", () => {
    expect(
      decideLeave({
        role: "member",
        memberUserIds: ["owner-a", "member-b"],
        leaverUserId: "member-b",
      }),
    ).toEqual({ kind: "leave", softDelete: false });
  });
});

describe("buildLeavePlan", () => {
  const context: LeaveContext = {
    householdId: "hh-1",
    role: "owner",
    memberUserIds: ["owner-a", "member-b"],
  };

  it("maps promote_then_leave onto the plan", () => {
    expect(buildLeavePlan(context, "owner-a", "member-b")).toEqual({
      userId: "owner-a",
      householdId: "hh-1",
      promoteUserId: "member-b",
      softDelete: false,
    });
  });

  it("maps last-member leave onto softDelete", () => {
    expect(
      buildLeavePlan(
        { householdId: "hh-1", role: "owner", memberUserIds: ["solo"] },
        "solo",
      ),
    ).toEqual({
      userId: "solo",
      householdId: "hh-1",
      promoteUserId: undefined,
      softDelete: true,
    });
  });
});

describe("leaveHousehold", () => {
  function fakePorts(context: LeaveContext): LeavePorts & { applied: LeavePlan[] } {
    const applied: LeavePlan[] = [];
    return {
      applied,
      async loadLeaveContext() {
        return context;
      },
      async applyLeave(plan) {
        applied.push(plan);
      },
    };
  }

  it("promotes the successor and does not soft-delete", async () => {
    const ports = fakePorts({
      householdId: "hh-1",
      role: "owner",
      memberUserIds: ["owner-a", "member-b"],
    });
    await leaveHousehold(ports, {
      userId: "owner-a",
      householdId: "hh-1",
      successorUserId: "member-b",
    });
    expect(ports.applied).toEqual([
      {
        userId: "owner-a",
        householdId: "hh-1",
        promoteUserId: "member-b",
        softDelete: false,
      },
    ]);
  });

  it("soft-deletes when the last member leaves", async () => {
    const ports = fakePorts({
      householdId: "hh-1",
      role: "owner",
      memberUserIds: ["solo"],
    });
    await leaveHousehold(ports, { userId: "solo", householdId: "hh-1" });
    expect(ports.applied).toEqual([
      {
        userId: "solo",
        householdId: "hh-1",
        promoteUserId: undefined,
        softDelete: true,
      },
    ]);
  });

  it("lets a non-owner leave without promote or soft-delete", async () => {
    const ports = fakePorts({
      householdId: "hh-1",
      role: "member",
      memberUserIds: ["owner-a", "member-b"],
    });
    await leaveHousehold(ports, { userId: "member-b", householdId: "hh-1" });
    expect(ports.applied).toEqual([
      {
        userId: "member-b",
        householdId: "hh-1",
        promoteUserId: undefined,
        softDelete: false,
      },
    ]);
  });

  it("rejects an owner who leaves without a successor", async () => {
    const ports = fakePorts({
      householdId: "hh-1",
      role: "owner",
      memberUserIds: ["owner-a", "member-b"],
    });
    await expect(
      leaveHousehold(ports, { userId: "owner-a", householdId: "hh-1" }),
    ).rejects.toThrow(/Appoint a new owner/);
    expect(ports.applied).toEqual([]);
  });

  it("surfaces load errors and never applies", async () => {
    const ports: LeavePorts & { applied: LeavePlan[] } = {
      applied: [],
      async loadLeaveContext() {
        throw new HttpError(403, "forbidden", "You are not a member of this household.");
      },
      async applyLeave(plan) {
        ports.applied.push(plan);
      },
    };
    await expect(
      leaveHousehold(ports, { userId: "stranger", householdId: "hh-1" }),
    ).rejects.toThrow(/not a member/);
    expect(ports.applied).toEqual([]);
  });

  it("never puts join or target fields on the plan", async () => {
    const ports = fakePorts({
      householdId: "hh-1",
      role: "member",
      memberUserIds: ["owner-a", "member-b"],
    });
    await leaveHousehold(ports, { userId: "member-b", householdId: "hh-1" });
    const plan = ports.applied[0]!;
    expect(plan).not.toHaveProperty("inviteCode");
    expect(plan).not.toHaveProperty("target");
    expect(plan).not.toHaveProperty("alreadyMember");
  });
});
