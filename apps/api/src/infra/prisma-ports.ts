import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  AddLotRequest,
  ChatRole,
  ChatTurn,
  CreateItemRequest,
  HouseholdSummary,
  ItemCategory,
  LocationName,
  Role,
  UpdateItemRequest,
  UpdateLotRequest,
} from "@smart-pantry/contracts";
import { ITEM_CATEGORIES } from "@smart-pantry/contracts";
import { HttpError } from "./errors";
import { assertMembership } from "../modules/household/access";
import type { LeavePlan } from "../modules/household/leave";
import type { ItemDraft } from "../modules/inventory/freshness";
import type { LotDraft } from "../modules/inventory/fifo";
import { roundQty } from "../modules/inventory/fifo";
import { planStockLine } from "../modules/inventory/stock-plan";
import { chatTurnWhere } from "../modules/recommendations/chat";

type ItemWithLots = Prisma.ItemGetPayload<{ include: { lots: true } }>;

function asLocation(value: string): LocationName {
  if (value === "freezer" || value === "pantry" || value === "refrigerator") return value;
  return "refrigerator";
}

function asCategory(value: string): ItemCategory {
  if (value === "produce") return "vegetable";
  return (ITEM_CATEGORIES as string[]).includes(value) ? (value as ItemCategory) : "other";
}

function asRole(value: string): Role {
  return value === "owner" ? "owner" : "member";
}

function asChatRole(value: string): ChatRole {
  return value === "member" ? "member" : "pantry";
}

function mapChatTurn(turn: { id: string; role: string; body: string; createdAt: Date }): ChatTurn {
  return {
    id: turn.id,
    role: asChatRole(turn.role),
    body: turn.body,
    createdAt: turn.createdAt.toISOString(),
  };
}

function dateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function mapItem(item: ItemWithLots): ItemDraft {
  return {
    id: item.id,
    householdId: item.householdId,
    name: item.name,
    unit: item.unit,
    category: asCategory(item.category),
    parLevel: item.parLevel,
    pinned: item.pinned,
    lots: item.lots.map((lot) => ({
      id: lot.id,
      location: asLocation(lot.location),
      quantity: lot.quantity,
      expiryDate: dateOnly(lot.expiryDate),
    })),
  };
}

const includeLots = { lots: true } as const;

export function createPorts(prisma: PrismaClient) {
  return {
    async findUserByEmail(email: string) {
      return prisma.user.findUnique({ where: { email } });
    },
    async findUserById(id: string) {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return null;
      return { id: user.id, email: user.email, displayName: user.displayName };
    },
    async findUserCredentials(id: string) {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
      };
    },
    async createUser(input: { email: string; passwordHash: string; displayName: string }) {
      const user = await prisma.user.create({ data: input });
      return { id: user.id, email: user.email, displayName: user.displayName };
    },
    async updateUser(id: string, input: { email?: string; displayName?: string; passwordHash?: string }) {
      const user = await prisma.user.update({ where: { id }, data: input });
      return { id: user.id, email: user.email, displayName: user.displayName };
    },
    async createSession(userId: string, tokenHash: string, expiresAt: Date) {
      await prisma.session.create({ data: { userId, tokenHash, expiresAt } });
    },
    async findUserIdBySession(tokenHash: string) {
      const session = await prisma.session.findUnique({ where: { tokenHash } });
      if (!session || session.expiresAt.getTime() < Date.now()) {
        if (session) await prisma.session.delete({ where: { id: session.id } });
        return null;
      }
      return session.userId;
    },
    async deleteSession(tokenHash: string) {
      await prisma.session.deleteMany({ where: { tokenHash } });
    },
    async createHousehold(input: { name: string; inviteCode: string; ownerId: string }): Promise<HouseholdSummary> {
      const household = await prisma.household.create({
        data: {
          name: input.name,
          inviteCode: input.inviteCode,
          memberships: { create: { userId: input.ownerId, role: "owner" } },
        },
      });
      return { id: household.id, name: household.name, role: "owner", inviteCode: household.inviteCode };
    },
    async listHouseholds(userId: string): Promise<HouseholdSummary[]> {
      const memberships = await prisma.membership.findMany({
        where: { userId, household: { deletedAt: null } },
        include: { household: true },
        orderBy: { household: { name: "asc" } },
      });
      return memberships.map((membership) => ({
        id: membership.household.id,
        name: membership.household.name,
        role: asRole(membership.role),
        inviteCode: membership.household.inviteCode,
      }));
    },
    async findHouseholdByInvite(inviteCode: string) {
      return prisma.household.findFirst({ where: { inviteCode, deletedAt: null } });
    },
    async membership(userId: string, householdId: string) {
      const membership = await prisma.membership.findUnique({
        where: { householdId_userId: { householdId, userId } },
      });
      return membership ? { role: asRole(membership.role) } : null;
    },
    async addMember(householdId: string, userId: string) {
      await prisma.membership.create({ data: { householdId, userId, role: "member" } });
    },
    async listMembers(householdId: string) {
      const memberships = await prisma.membership.findMany({
        where: { householdId, household: { deletedAt: null } },
        include: { user: { select: { id: true, displayName: true } } },
        orderBy: { user: { displayName: "asc" } },
      });
      return memberships.map((membership) => ({
        userId: membership.user.id,
        displayName: membership.user.displayName,
        role: asRole(membership.role),
      }));
    },
    async loadLeaveContext(input: { userId: string; householdId: string }) {
      const household = await prisma.household.findFirst({
        where: { id: input.householdId, deletedAt: null },
        include: { memberships: true },
      });
      if (!household) throw new HttpError(404, "not_found", "That household was not found.");

      const leaver = household.memberships.find((row) => row.userId === input.userId);
      if (!leaver) throw new HttpError(403, "forbidden", "You are not a member of this household.");

      return {
        householdId: household.id,
        role: asRole(leaver.role),
        memberUserIds: household.memberships.map((row) => row.userId),
      };
    },
    async applyLeave(plan: LeavePlan) {
      await prisma.$transaction(async (tx) => {
        if (plan.promoteUserId) {
          await tx.membership.update({
            where: {
              householdId_userId: { householdId: plan.householdId, userId: plan.promoteUserId },
            },
            data: { role: "owner" },
          });
        }

        await tx.membership.delete({
          where: { householdId_userId: { householdId: plan.householdId, userId: plan.userId } },
        });

        await tx.chatTurn.deleteMany({
          where: plan.softDelete
            ? { householdId: plan.householdId }
            : chatTurnWhere(plan.householdId, plan.userId),
        });

        if (plan.softDelete) {
          await tx.household.update({
            where: { id: plan.householdId },
            data: { deletedAt: new Date() },
          });
        }
      });
    },
    async householdName(householdId: string) {
      const household = await prisma.household.findFirst({ where: { id: householdId, deletedAt: null } });
      return household?.name ?? null;
    },
    async listItems(householdId: string) {
      const items = await prisma.item.findMany({
        where: { householdId },
        include: includeLots,
        orderBy: { name: "asc" },
      });
      return items.map(mapItem);
    },
    async createItem(householdId: string, input: CreateItemRequest) {
      const item = await prisma.item.create({
        data: {
          householdId,
          name: input.name.trim(),
          unit: input.unit.trim(),
          category: input.category,
          parLevel: input.parLevel,
          lots: {
            create: {
              location: input.location,
              quantity: roundQty(input.quantity),
              expiryDate: parseDate(input.expiryDate),
            },
          },
        },
        include: includeLots,
      });
      return mapItem(item);
    },
    async updateItem(householdId: string, itemId: string, input: UpdateItemRequest) {
      const existing = await prisma.item.findFirst({ where: { id: itemId, householdId } });
      if (!existing) throw new HttpError(404, "not_found", "That item is not in this household.");
      const item = await prisma.item.update({
        where: { id: itemId },
        data: {
          name: input.name?.trim(),
          unit: input.unit?.trim(),
          category: input.category,
          parLevel: input.parLevel,
          pinned: input.pinned,
        },
        include: includeLots,
      });
      return mapItem(item);
    },
    async addLot(householdId: string, itemId: string, input: AddLotRequest) {
      const existing = await prisma.item.findFirst({ where: { id: itemId, householdId } });
      if (!existing) throw new HttpError(404, "not_found", "That item is not in this household.");
      await prisma.stockLot.create({
        data: {
          itemId,
          location: input.location,
          quantity: roundQty(input.quantity),
          expiryDate: parseDate(input.expiryDate),
        },
      });
      const item = await prisma.item.findFirstOrThrow({ where: { id: itemId, householdId }, include: includeLots });
      return mapItem(item);
    },
    async updateLot(householdId: string, lotId: string, input: UpdateLotRequest) {
      const lot = await prisma.stockLot.findFirst({ where: { id: lotId, item: { householdId } } });
      if (!lot) throw new HttpError(404, "not_found", "That stock lot is not in this household.");
      if (input.quantity != null && input.quantity <= 0) {
        await prisma.stockLot.delete({ where: { id: lotId } });
      } else {
        await prisma.stockLot.update({
          where: { id: lotId },
          data: {
            quantity: input.quantity == null ? undefined : roundQty(input.quantity),
            location: input.location,
            expiryDate: input.expiryDate === undefined ? undefined : parseDate(input.expiryDate),
          },
        });
      }
      const item = await prisma.item.findFirstOrThrow({ where: { id: lot.itemId, householdId }, include: includeLots });
      return mapItem(item);
    },
    async saveConsumption(input: {
      householdId: string;
      itemId: string;
      userId: string;
      quantity: number;
      lots: LotDraft[];
    }) {
      return prisma.$transaction(async (tx) => {
        const item = await tx.item.findFirst({ where: { id: input.itemId, householdId: input.householdId } });
        if (!item) throw new HttpError(404, "not_found", "That item is not in this household.");
        const keep = new Set(input.lots.map((lot) => lot.id));
        await tx.stockLot.deleteMany({ where: { itemId: input.itemId, id: { notIn: [...keep] } } });
        for (const lot of input.lots) {
          await tx.stockLot.update({
            where: { id: lot.id },
            data: { quantity: roundQty(lot.quantity) },
          });
        }
        await tx.useEvent.create({
          data: {
            householdId: input.householdId,
            itemId: input.itemId,
            userId: input.userId,
            quantity: roundQty(input.quantity),
          },
        });
        const next = await tx.item.findFirstOrThrow({
          where: { id: input.itemId, householdId: input.householdId },
          include: includeLots,
        });
        return mapItem(next);
      });
    },
    async saveMealConsumption(input: {
      householdId: string;
      userId: string;
      lines: { itemId: string; quantity: number; lots: LotDraft[] }[];
    }) {
      await prisma.$transaction(async (tx) => {
        for (const line of input.lines) {
          const item = await tx.item.findFirst({
            where: { id: line.itemId, householdId: input.householdId },
          });
          if (!item) throw new HttpError(404, "not_found", "That item is not in this household.");
          const keep = new Set(line.lots.map((lot) => lot.id));
          await tx.stockLot.deleteMany({ where: { itemId: line.itemId, id: { notIn: [...keep] } } });
          for (const lot of line.lots) {
            await tx.stockLot.update({
              where: { id: lot.id },
              data: { quantity: roundQty(lot.quantity) },
            });
          }
          await tx.useEvent.create({
            data: {
              householdId: input.householdId,
              itemId: line.itemId,
              userId: input.userId,
              quantity: roundQty(line.quantity),
            },
          });
        }
      });
    },
    async useCounts(householdId: string, since: Date) {
      const grouped = await prisma.useEvent.groupBy({
        by: ["itemId"],
        where: { householdId, usedAt: { gte: since } },
        _count: { _all: true },
      });
      return grouped.map((row) => ({ itemId: row.itemId, count: row._count._all }));
    },
    async listChatTurns(householdId: string, userId: string): Promise<ChatTurn[]> {
      const rows = await prisma.chatTurn.findMany({
        where: chatTurnWhere(householdId, userId),
        orderBy: { createdAt: "asc" },
      });
      return rows.map(mapChatTurn);
    },
    async appendChatTurns(input: {
      householdId: string;
      userId: string;
      memberBody: string;
      pantryBody: string;
    }): Promise<{ member: ChatTurn; pantry: ChatTurn }> {
      const memberAt = new Date();
      const pantryAt = new Date(memberAt.getTime() + 1);
      const [member, pantry] = await prisma.$transaction([
        prisma.chatTurn.create({
          data: {
            householdId: input.householdId,
            userId: input.userId,
            role: "member",
            body: input.memberBody,
            createdAt: memberAt,
          },
        }),
        prisma.chatTurn.create({
          data: {
            householdId: input.householdId,
            userId: input.userId,
            role: "pantry",
            body: input.pantryBody,
            createdAt: pantryAt,
          },
        }),
      ]);
      return { member: mapChatTurn(member), pantry: mapChatTurn(pantry) };
    },
    async listDismissals(householdId: string) {
      const rows = await prisma.shoppingDismissal.findMany({ where: { householdId } });
      return rows.map((row) => ({ key: row.itemKey, stockFingerprint: row.stockFingerprint }));
    },
    async dismiss(householdId: string, key: string, fingerprint: string) {
      await prisma.shoppingDismissal.upsert({
        where: { householdId_itemKey: { householdId, itemKey: key } },
        create: { householdId, itemKey: key, stockFingerprint: fingerprint },
        update: { stockFingerprint: fingerprint },
      });
    },
    async commitIntakeLines(
      userId: string,
      householdId: string,
      location: LocationName,
      lines: {
        name: string;
        quantity: number;
        unit: string;
        expiryDate: string | null;
      }[],
    ): Promise<ItemDraft[]> {
      return prisma.$transaction(async (tx) => {
        const membership = await tx.membership.findUnique({
          where: { householdId_userId: { householdId, userId } },
        });
        assertMembership(membership ? { role: asRole(membership.role) } : null);

        const known = (
          await tx.item.findMany({ where: { householdId }, include: includeLots })
        ).map(mapItem);
        const committed: ItemDraft[] = [];

        for (const line of lines) {
          const plan = planStockLine(
            known,
            {
              name: line.name,
              unit: line.unit,
              quantity: line.quantity,
              location,
              expiryDate: line.expiryDate,
              parLevel: null,
              category: "other",
            },
            { enrich: false },
          );

          let next: ItemDraft;
          if (plan.kind === "create") {
            next = mapItem(
              await tx.item.create({
                data: {
                  householdId,
                  name: plan.create.name.trim(),
                  unit: plan.create.unit.trim(),
                  category: plan.create.category,
                  parLevel: plan.create.parLevel,
                  lots: {
                    create: {
                      location: plan.create.location,
                      quantity: roundQty(plan.create.quantity),
                      expiryDate: parseDate(plan.create.expiryDate),
                    },
                  },
                },
                include: includeLots,
              }),
            );
          } else {
            await tx.stockLot.create({
              data: {
                itemId: plan.itemId,
                location: plan.lot.location,
                quantity: roundQty(plan.lot.quantity),
                expiryDate: parseDate(plan.lot.expiryDate),
              },
            });
            next = mapItem(
              await tx.item.findFirstOrThrow({
                where: { id: plan.itemId, householdId },
                include: includeLots,
              }),
            );
          }

          const index = known.findIndex((item) => item.id === next.id);
          if (index >= 0) known[index] = next;
          else known.push(next);
          committed.push(next);
        }
        return committed;
      });
    },
    async findMemberLogin(userId: string) {
      return prisma.memberLogin.findUnique({ where: { userId } });
    },
    async upsertMemberLogin(userId: string, sealedHome: string) {
      return prisma.memberLogin.upsert({
        where: { userId },
        create: { userId, sealedHome },
        update: { sealedHome, connectedAt: new Date() },
      });
    },
    async deleteMemberLogin(userId: string) {
      await prisma.memberLogin.deleteMany({ where: { userId } });
    },
  };
}

export type AppPorts = ReturnType<typeof createPorts>;
