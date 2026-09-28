import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { HttpError } from "../../infra/errors";
import type { AppPorts } from "../../infra/prisma-ports";
import { newInviteCode } from "../../infra/tokens";
import { readBody, requireUser } from "../../http/parse";

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter a household name.").max(80),
});

const joinSchema = z.object({
  inviteCode: z.string().trim().min(4, "Enter an invite code.").max(16),
});

export function householdPlugin(ports: AppPorts): FastifyPluginAsync {
  return async (app) => {
    app.post("/households", async (request) => {
      const user = requireUser(request);
      const body = readBody(createSchema, request.body);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const household = await ports.createHousehold({
            name: body.name,
            inviteCode: newInviteCode(),
            ownerId: user.id,
          });
          return { household };
        } catch (error) {
          const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
          if (code !== "P2002") throw error;
        }
      }
      throw new HttpError(500, "internal", "Could not create a household.");
    });

    app.get("/households", async (request) => {
      const user = requireUser(request);
      return { households: await ports.listHouseholds(user.id) };
    });

    app.post("/households/join", async (request) => {
      const user = requireUser(request);
      const body = readBody(joinSchema, request.body);
      const code = body.inviteCode.trim().toUpperCase();
      const found = await ports.findHouseholdByInvite(code);
      if (!found) throw new HttpError(404, "not_found", "That invite code does not match a household.");
      const membership = await ports.membership(user.id, found.id);
      if (!membership) await ports.addMember(found.id, user.id);
      return {
        household: {
          id: found.id,
          name: found.name,
          role: membership?.role ?? "member",
          inviteCode: found.inviteCode,
        },
      };
    });
  };
}
