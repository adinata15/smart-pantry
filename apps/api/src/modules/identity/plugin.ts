import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { HttpError } from "../../infra/errors";
import type { AppPorts } from "../../infra/prisma-ports";
import { hashPassword, verifyPassword } from "../../infra/password";
import { hashToken, newSessionToken } from "../../infra/tokens";
import { SESSION_COOKIE, sessionCookieOptions } from "../../http/cookies";
import { readBody, requireUser } from "../../http/parse";
import { updateProfile } from "./update-profile";

const signUpSchema = z.object({
  email: z.string().email("Enter an email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  displayName: z.string().trim().min(1, "Enter your name.").max(80),
});

const signInSchema = z.object({
  email: z.string().email("Enter an email address."),
  password: z.string().min(1, "Enter your password."),
});

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name.").max(80).optional(),
  email: z.string().email("Enter an email address.").optional(),
  currentPassword: z.string().min(1, "Enter your current password.").optional(),
  newPassword: z.string().min(8, "Use at least 8 characters.").optional(),
});

function expiry() {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
}

function emailTaken(): never {
  throw new HttpError(409, "email_taken", "An account with that email already exists.");
}

async function issueSession(ports: AppPorts, userId: string) {
  const token = newSessionToken();
  await ports.createSession(userId, hashToken(token), expiry());
  return token;
}

export function identityPlugin(ports: AppPorts): FastifyPluginAsync {
  return async (app) => {
    app.post("/auth/sign-up", async (request, reply) => {
      const body = readBody(signUpSchema, request.body);
      const email = body.email.trim().toLowerCase();
      if (await ports.findUserByEmail(email)) emailTaken();
      let user;
      try {
        user = await ports.createUser({
          email,
          passwordHash: await hashPassword(body.password),
          displayName: body.displayName.trim(),
        });
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code === "P2002") emailTaken();
        throw error;
      }
      reply.setCookie(SESSION_COOKIE, await issueSession(ports, user.id), sessionCookieOptions());
      return { user };
    });

    app.post("/auth/sign-in", async (request, reply) => {
      const body = readBody(signInSchema, request.body);
      const email = body.email.trim().toLowerCase();
      const existing = await ports.findUserByEmail(email);
      const passwordHash = existing?.passwordHash ?? "scrypt$" + "00".repeat(16) + "$" + "11".repeat(32);
      const matches = await verifyPassword(body.password, passwordHash);
      if (!existing || !matches) {
        throw new HttpError(401, "invalid_credentials", "Email or password is incorrect.");
      }
      reply.setCookie(SESSION_COOKIE, await issueSession(ports, existing.id), sessionCookieOptions());
      return { user: { id: existing.id, email: existing.email, displayName: existing.displayName } };
    });

    app.post("/auth/sign-out", async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE];
      if (token) await ports.deleteSession(hashToken(token));
      const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions();
      reply.clearCookie(SESSION_COOKIE, clearOptions);
      return { ok: true };
    });

    app.get("/auth/me", async (request) => {
      return { user: requireUser(request) };
    });

    app.patch("/auth/me", async (request) => {
      const user = requireUser(request);
      const body = readBody(updateProfileSchema, request.body);
      return { user: await updateProfile(ports, user.id, body) };
    });
  };
}
