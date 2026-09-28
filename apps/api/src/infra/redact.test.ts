import { afterEach, describe, expect, it } from "vitest";
import { redactValue } from "./redact";

const original = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = original;
});

describe("redactValue", () => {
  it("removes the API key from strings and nested logs", () => {
    process.env.OPENAI_API_KEY = "sk-test-secret-value";
    const scrubbed = redactValue({
      msg: "failed with sk-test-secret-value",
      nested: ["sk-test-secret-value"],
    });
    expect(JSON.stringify(scrubbed)).not.toContain("sk-test-secret-value");
    expect(JSON.stringify(scrubbed)).toContain("[redacted]");
  });
});
