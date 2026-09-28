import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AppPorts } from "../../infra/prisma-ports";
import { readBody, requireUser } from "../../http/parse";
import { readToday } from "../../http/query";
import { toPantryItem } from "../inventory/freshness";
import { parseReceipt } from "./parse-receipt";

const parseSchema = z.object({
  text: z.string().max(20000, "That receipt text is too long."),
});

const commitSchema = z.object({
  location: z.enum(["refrigerator", "freezer", "pantry"]),
  lines: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        quantity: z.number().positive(),
        unit: z.string().trim().min(1).max(20),
        expiryDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]),
      }),
    )
    .max(50),
});

export function intakePlugin(ports: AppPorts): FastifyPluginAsync {
  return async (app) => {
    app.post("/intake/parse", async (request) => {
      requireUser(request);
      const body = readBody(parseSchema, request.body);
      return { lines: parseReceipt(body.text) };
    });

    app.post("/households/:householdId/intake/commit", async (request) => {
      const user = requireUser(request);
      const { householdId } = request.params as { householdId: string };
      const body = readBody(commitSchema, request.body);
      const today = readToday(request.query);
      const drafts = await ports.commitIntakeLines(user.id, householdId, body.location, body.lines);
      return { items: drafts.map((item) => toPantryItem(item, today)) };
    });
  };
}
