import type { FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import { HttpError } from "../infra/errors";

export function readBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, "validation", result.error.issues[0]?.message ?? "Check the form.");
  }
  return result.data;
}

export function requireUser(request: FastifyRequest) {
  if (!request.user) throw new HttpError(401, "unauthorized", "Sign in required.");
  return request.user;
}
