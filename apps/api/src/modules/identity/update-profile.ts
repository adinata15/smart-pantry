import type { PublicUser, UpdateProfileRequest } from "@smart-pantry/contracts";
import { HttpError } from "../../infra/errors";
import { hashPassword, verifyPassword } from "../../infra/password";

export interface ProfileAccount {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

export interface IdentityPorts {
  findUserCredentials(id: string): Promise<ProfileAccount | null>;
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  updateUser(
    id: string,
    input: { email?: string; displayName?: string; passwordHash?: string },
  ): Promise<PublicUser>;
}

type ProfilePatch = { email?: string; displayName?: string; passwordHash?: string };

function emailTaken(): never {
  throw new HttpError(409, "email_taken", "An account with that email already exists.");
}

function toPublicUser(account: ProfileAccount): PublicUser {
  return { id: account.id, email: account.email, displayName: account.displayName };
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

export async function updateProfile(
  ports: IdentityPorts,
  userId: string,
  input: UpdateProfileRequest,
): Promise<PublicUser> {
  const displayName = input.displayName === undefined ? undefined : input.displayName.trim();
  const email = input.email === undefined ? undefined : input.email.trim().toLowerCase();
  const newPassword =
    input.newPassword !== undefined && input.newPassword.length > 0 ? input.newPassword : undefined;
  const currentPassword = newPassword !== undefined ? input.currentPassword : undefined;

  if (displayName === undefined && email === undefined && newPassword === undefined) {
    throw new HttpError(400, "validation", "Nothing to update.");
  }

  if (displayName !== undefined) {
    if (displayName.length < 1) {
      throw new HttpError(400, "validation", "Enter your name.");
    }
    if (displayName.length > 80) {
      throw new HttpError(400, "validation", "Name is too long.");
    }
  }

  if (email !== undefined && !email.includes("@")) {
    throw new HttpError(400, "validation", "Enter an email address.");
  }

  if (newPassword !== undefined) {
    if (!currentPassword) {
      throw new HttpError(400, "validation", "Enter your current password.");
    }
    if (newPassword.length < 8) {
      throw new HttpError(400, "validation", "Use at least 8 characters.");
    }
  }

  const account = await ports.findUserCredentials(userId);
  if (!account) throw new HttpError(401, "unauthorized", "Sign in required.");

  const patch: ProfilePatch = {};

  if (displayName !== undefined && displayName !== account.displayName) {
    patch.displayName = displayName;
  }

  if (email !== undefined && email !== account.email) {
    const existing = await ports.findUserByEmail(email);
    if (existing && existing.id !== userId) emailTaken();
    patch.email = email;
  }

  if (newPassword !== undefined && currentPassword) {
    const matches = await verifyPassword(currentPassword, account.passwordHash);
    if (!matches) {
      throw new HttpError(401, "invalid_credentials", "Current password is incorrect.");
    }
    patch.passwordHash = await hashPassword(newPassword);
  }

  if (Object.keys(patch).length === 0) return toPublicUser(account);

  try {
    return await ports.updateUser(userId, patch);
  } catch (error) {
    if (isPrismaUniqueConflict(error)) emailTaken();
    throw error;
  }
}
