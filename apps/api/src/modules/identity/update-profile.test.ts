import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../infra/errors";
import { hashPassword, verifyPassword } from "../../infra/password";
import { updateProfile, type IdentityPorts, type ProfileAccount } from "./update-profile";

function unused(): never {
  throw new Error("unused");
}

function account(partial?: Partial<ProfileAccount>): ProfileAccount {
  return {
    id: "user-1",
    email: "nata@example.com",
    displayName: "Nata",
    passwordHash: "scrypt$salt$hash",
    ...partial,
  };
}

function stubPorts(partial: Partial<IdentityPorts> & Pick<IdentityPorts, "findUserCredentials">): IdentityPorts {
  return {
    findUserByEmail: async () => null,
    updateUser: async () => unused(),
    ...partial,
  };
}

describe("updateProfile", () => {
  it("rejects an empty body", async () => {
    await expect(
      updateProfile(stubPorts({ findUserCredentials: async () => account() }), "user-1", {}),
    ).rejects.toMatchObject({ status: 400, code: "validation" });
  });

  it("updates display name and email", async () => {
    const updateUser = vi.fn(async (_id: string, input: { email?: string; displayName?: string }) => ({
      id: "user-1",
      email: input.email ?? "nata@example.com",
      displayName: input.displayName ?? "Nata",
    }));
    const result = await updateProfile(
      stubPorts({
        findUserCredentials: async () => account(),
        updateUser,
      }),
      "user-1",
      { displayName: "  Nat  ", email: "Nat@Example.COM" },
    );
    expect(updateUser).toHaveBeenCalledWith("user-1", {
      displayName: "Nat",
      email: "nat@example.com",
    });
    expect(result).toEqual({ id: "user-1", email: "nat@example.com", displayName: "Nat" });
  });

  it("rejects an email already used by another account", async () => {
    await expect(
      updateProfile(
        stubPorts({
          findUserCredentials: async () => account(),
          findUserByEmail: async () => ({ id: "other" }),
        }),
        "user-1",
        { email: "taken@example.com" },
      ),
    ).rejects.toMatchObject({ status: 409, code: "email_taken" });
  });

  it("maps Prisma unique conflicts to email_taken", async () => {
    const error = await updateProfile(
      stubPorts({
        findUserCredentials: async () => account(),
        updateUser: async () => {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        },
      }),
      "user-1",
      { email: "new@example.com" },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 409, code: "email_taken" });
  });

  it("rejects a wrong current password", async () => {
    const passwordHash = await hashPassword("correct-password");
    await expect(
      updateProfile(
        stubPorts({
          findUserCredentials: async () => account({ passwordHash }),
        }),
        "user-1",
        { currentPassword: "wrong-password", newPassword: "new-password" },
      ),
    ).rejects.toMatchObject({
      status: 401,
      code: "invalid_credentials",
      message: "Current password is incorrect.",
    });
  });

  it("replaces the password hash when the current password matches", async () => {
    const passwordHash = await hashPassword("correct-password");
    const updateUser = vi.fn(async () => ({
      id: "user-1",
      email: "nata@example.com",
      displayName: "Nata",
    }));
    await updateProfile(
      stubPorts({
        findUserCredentials: async () => account({ passwordHash }),
        updateUser,
      }),
      "user-1",
      { currentPassword: "correct-password", newPassword: "brand-new-pass" },
    );
    const patch = updateUser.mock.calls[0]![1] as { passwordHash: string };
    expect(patch.passwordHash).toBeDefined();
    expect(patch.passwordHash).not.toBe(passwordHash);
    expect(await verifyPassword("brand-new-pass", patch.passwordHash)).toBe(true);
  });

  it("requires the current password when setting a new one", async () => {
    await expect(
      updateProfile(
        stubPorts({ findUserCredentials: async () => account() }),
        "user-1",
        { newPassword: "brand-new-pass" },
      ),
    ).rejects.toMatchObject({ status: 400, code: "validation" });
  });
});
