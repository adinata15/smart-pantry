import { describe, expect, it, vi } from "vitest";
import type { RecommendationModel } from "./advise";
import { resolveRecommendationModel } from "./resolve-model";

describe("resolveRecommendationModel", () => {
  it("prefers a sealed member login over the process model", async () => {
    process.env.CODEX_LOGIN_KEY = "test-seal-key-value-16";
    const processModel: RecommendationModel = {
      advise: vi.fn(async () => ({ meals: [], shoppingNotes: [] })),
    };
    const ports = {
      findMemberLogin: vi.fn(async () => ({
        id: "login-1",
        userId: "user-1",
        sealedHome: "sealed-blob",
        connectedAt: new Date(),
      })),
    };
    const model = await resolveRecommendationModel(ports as never, "user-1", processModel);
    expect(model).not.toBe(processModel);
    expect(model).not.toBeNull();
  });

  it("falls back to the process model when the member has no login", async () => {
    const processModel: RecommendationModel = {
      advise: vi.fn(async () => ({ meals: [], shoppingNotes: [] })),
    };
    const ports = {
      findMemberLogin: vi.fn(async () => null),
    };
    const model = await resolveRecommendationModel(ports as never, "user-1", processModel);
    expect(model).toBe(processModel);
  });
});
