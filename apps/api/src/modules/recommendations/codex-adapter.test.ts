import { describe, expect, it } from "vitest";
import { extractJsonPayload } from "./codex-adapter";

describe("extractJsonPayload", () => {
  it("accepts a bare JSON object", () => {
    const raw = '{"meals":[{"recipeId":"r1","advice":"use milk"}],"shoppingNotes":[]}';
    expect(JSON.parse(extractJsonPayload(raw)).meals[0].recipeId).toBe("r1");
  });

  it("unwraps a fenced JSON block", () => {
    const raw = 'Here you go:\n```json\n{"meals":[],"shoppingNotes":[]}\n```\n';
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({ meals: [], shoppingNotes: [] });
  });

  it("reads the last NDJSON agent message content", () => {
    const raw = [
      '{"type":"thread.started"}',
      '{"type":"agent_message","content":"{\\"meals\\":[],\\"shoppingNotes\\":[]}"}',
    ].join("\n");
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({ meals: [], shoppingNotes: [] });
  });
});
