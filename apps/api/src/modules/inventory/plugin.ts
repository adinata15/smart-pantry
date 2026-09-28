import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AppPorts } from "../../infra/prisma-ports";
import { readBody, requireUser } from "../../http/parse";
import { readToday } from "../../http/query";
import { toPantryItem } from "./freshness";
import { addLotToItem, addStock, editItem, editLot, readHouseholdItems } from "./use-cases";

const location = z.enum(["refrigerator", "freezer", "pantry"]);
const expiry = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date."), z.null()]);

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter an item name.").max(80),
  unit: z.string().trim().min(1).max(20),
  quantity: z.number().positive("Quantity must be greater than zero."),
  location,
  expiryDate: expiry,
  parLevel: z.number().positive().nullable(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  parLevel: z.number().positive().nullable().optional(),
  pinned: z.boolean().optional(),
});

const lotSchema = z.object({
  quantity: z.number().positive(),
  location,
  expiryDate: expiry,
});

const updateLotSchema = z.object({
  quantity: z.number().min(0).optional(),
  location: location.optional(),
  expiryDate: expiry.optional(),
});

export function inventoryPlugin(ports: AppPorts): FastifyPluginAsync {
  return async (app) => {
    app.get("/households/:householdId/items", async (request) => {
      const user = requireUser(request);
      const { householdId } = request.params as { householdId: string };
      const today = readToday(request.query);
      const items = await readHouseholdItems(ports, user.id, householdId);
      return { items: items.map((item) => toPantryItem(item, today)) };
    });

    app.post("/households/:householdId/items", async (request) => {
      const user = requireUser(request);
      const { householdId } = request.params as { householdId: string };
      const body = readBody(createSchema, request.body);
      const item = await addStock(ports, user.id, householdId, body);
      return { item: toPantryItem(item, readToday(request.query)) };
    });

    app.patch("/households/:householdId/items/:itemId", async (request) => {
      const user = requireUser(request);
      const { householdId, itemId } = request.params as { householdId: string; itemId: string };
      const body = readBody(updateSchema, request.body);
      const item = await editItem(ports, user.id, householdId, itemId, body);
      return { item: toPantryItem(item, readToday(request.query)) };
    });

    app.post("/households/:householdId/items/:itemId/lots", async (request) => {
      const user = requireUser(request);
      const { householdId, itemId } = request.params as { householdId: string; itemId: string };
      const body = readBody(lotSchema, request.body);
      const item = await addLotToItem(ports, user.id, householdId, itemId, body);
      return { item: toPantryItem(item, readToday(request.query)) };
    });

    app.patch("/households/:householdId/lots/:lotId", async (request) => {
      const user = requireUser(request);
      const { householdId, lotId } = request.params as { householdId: string; lotId: string };
      const body = readBody(updateLotSchema, request.body);
      const item = await editLot(ports, user.id, householdId, lotId, body);
      return { item: toPantryItem(item, readToday(request.query)) };
    });
  };
}
