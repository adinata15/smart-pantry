import { describe, expect, it } from "vitest";
import { HttpError } from "../../infra/errors";
import { decideLeave } from "./leave";

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
