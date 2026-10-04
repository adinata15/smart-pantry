import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPorts } from "./prisma-ports";

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim() || undefined;
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(apiRoot, "package.json"));

const DEV_DATABASE = "smart_pantry";

function databaseName(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid connection string.");
  }
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) throw new Error("TEST_DATABASE_URL is missing a database name.");
  return name;
}

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function maintenanceUrl(connectionString: string): string {
  const url = new URL(connectionString);
  url.pathname = "/postgres";
  return url.toString();
}

function assertAdapterDatabase(connectionString: string): void {
  if (databaseName(connectionString) === DEV_DATABASE) {
    throw new Error("TEST_DATABASE_URL must not use the smart_pantry database.");
  }
}

if (testDatabaseUrl) assertAdapterDatabase(testDatabaseUrl);

describe("leave adapter database name", () => {
  it("rejects the dev database", () => {
    expect(() => assertAdapterDatabase("postgresql://localhost/smart_pantry")).toThrow(/smart_pantry/);
  });

  it("allows another database name", () => {
    expect(() => assertAdapterDatabase("postgresql://localhost/smart_pantry_test")).not.toThrow();
  });

  it("reads the database name from the connection string", () => {
    expect(databaseName("postgresql://pantry:pantry@localhost:5433/other_db?schema=public")).toBe("other_db");
  });

  it("points maintenance at the postgres database on the same server", () => {
    expect(maintenanceUrl("postgresql://pantry:pantry@localhost:5433/other_db?schema=public")).toBe(
      "postgresql://pantry:pantry@localhost:5433/postgres?schema=public",
    );
  });

  it("quotes the database name as one identifier", () => {
    expect(quoteIdentifier('odd"name')).toBe('"odd""name"');
  });
});

describe.skipIf(!testDatabaseUrl)("leave adapter", () => {
  const databaseUrl = testDatabaseUrl ?? "";
  let prisma: PrismaClient | undefined;
  let ports: ReturnType<typeof createPorts>;

  beforeAll(async () => {
    await ensureDatabase(databaseUrl);
    await migrate(databaseUrl);
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    ports = createPorts(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("promotes the successor and leaves the household in place", async () => {
    const ownerId = userId();
    const successorId = userId();
    await withHousehold(
      [
        { id: ownerId, role: "owner" },
        { id: successorId, role: "member" },
      ],
      async (householdId) => {
        await ports.applyLeave({
          userId: ownerId,
          householdId,
          promoteUserId: successorId,
          softDelete: false,
        });
        const memberships = await prisma!.membership.findMany({ where: { householdId } });
        expect(memberships.map((row) => ({ userId: row.userId, role: row.role }))).toEqual([
          { userId: successorId, role: "owner" },
        ]);
        const household = await prisma!.household.findUniqueOrThrow({ where: { id: householdId } });
        expect(household.deletedAt).toBeNull();
      },
    );
  });

  it("soft-deletes the household when the last member leaves", async () => {
    const ownerId = userId();
    await withHousehold([{ id: ownerId, role: "owner" }], async (householdId) => {
      await ports.applyLeave({
        userId: ownerId,
        householdId,
        softDelete: true,
      });
      const household = await prisma!.household.findUniqueOrThrow({ where: { id: householdId } });
      expect(household.deletedAt).toBeInstanceOf(Date);
      await expect(ports.loadLeaveContext({ userId: ownerId, householdId })).rejects.toMatchObject({
        status: 404,
        code: "not_found",
      });
    });
  });

  it("lets a non-owner leave without promoting anyone", async () => {
    const ownerId = userId();
    const memberId = userId();
    await withHousehold(
      [
        { id: ownerId, role: "owner" },
        { id: memberId, role: "member" },
      ],
      async (householdId) => {
        await ports.applyLeave({
          userId: memberId,
          householdId,
          softDelete: false,
        });
        const memberships = await prisma!.membership.findMany({ where: { householdId } });
        expect(memberships.map((row) => ({ userId: row.userId, role: row.role }))).toEqual([
          { userId: ownerId, role: "owner" },
        ]);
        const household = await prisma!.household.findUniqueOrThrow({ where: { id: householdId } });
        expect(household.deletedAt).toBeNull();
      },
    );
  });

  it("reports a household id that was never created", async () => {
    await expect(
      ports.loadLeaveContext({ userId: userId(), householdId: `missing-${randomUUID()}` }),
    ).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("reports a person who is not a member of the household", async () => {
    const ownerId = userId();
    const outsiderId = userId();
    try {
      await withHousehold([{ id: ownerId, role: "owner" }], async (householdId) => {
        await prisma!.user.create({
          data: {
            id: outsiderId,
            email: `${outsiderId}@leave-adapter.test`,
            passwordHash: "test",
            displayName: outsiderId,
          },
        });
        await expect(ports.loadLeaveContext({ userId: outsiderId, householdId })).rejects.toMatchObject({
          status: 403,
          code: "forbidden",
        });
      });
    } finally {
      await prisma!.user.deleteMany({ where: { id: outsiderId } });
    }
  });

  async function withHousehold(
    members: { id: string; role: "owner" | "member" }[],
    run: (householdId: string) => Promise<void>,
  ) {
    const householdId = `hh_${randomUUID().replaceAll("-", "")}`;
    const client = prisma!;
    try {
      for (const member of members) {
        await client.user.create({
          data: {
            id: member.id,
            email: `${member.id}@leave-adapter.test`,
            passwordHash: "test",
            displayName: member.id,
          },
        });
      }
      await client.household.create({
        data: {
          id: householdId,
          name: "Leave adapter",
          inviteCode: randomUUID().replaceAll("-", ""),
          memberships: {
            create: members.map((member) => ({ userId: member.id, role: member.role })),
          },
        },
      });
      await run(householdId);
    } finally {
      await client.household.deleteMany({ where: { id: householdId } });
      await client.user.deleteMany({ where: { id: { in: members.map((member) => member.id) } } });
    }
  }
});

function userId(): string {
  return `user_${randomUUID().replaceAll("-", "")}`;
}

async function ensureDatabase(connectionString: string): Promise<void> {
  const name = databaseName(connectionString);
  const admin = new Client({ connectionString: maintenanceUrl(connectionString) });
  await admin.connect();
  try {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${quoteIdentifier(name)}`);
    }
  } finally {
    await admin.end();
  }
}

async function migrate(databaseUrl: string): Promise<void> {
  const prismaJson = require.resolve("prisma/package.json");
  const prismaCli = resolve(dirname(prismaJson), "build/index.js");
  await execFileAsync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
