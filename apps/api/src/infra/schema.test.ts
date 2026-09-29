import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("persistence boundary", () => {
  it("does not store an API key column", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8").toLowerCase();
    expect(schema).not.toContain("openai");
    expect(schema).not.toContain("api_key");
    expect(schema).not.toContain("apikey");
    expect(schema).toContain("memberlogin");
    expect(schema).toContain("sealedhome");
  });
});
