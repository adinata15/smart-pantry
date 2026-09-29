import { afterEach, describe, expect, it } from "vitest";
import { codexLoginConfigured, openSealedText, sealText } from "./seal";

const original = process.env.CODEX_LOGIN_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.CODEX_LOGIN_KEY;
  else process.env.CODEX_LOGIN_KEY = original;
});

describe("sealText", () => {
  it("round-trips plaintext with CODEX_LOGIN_KEY", () => {
    process.env.CODEX_LOGIN_KEY = "test-seal-key-value-16";
    const sealed = sealText('{"auth.json":"secret-token-value"}');
    expect(sealed).not.toContain("secret-token-value");
    expect(openSealedText(sealed)).toBe('{"auth.json":"secret-token-value"}');
  });

  it("reports when the seal key is missing", () => {
    delete process.env.CODEX_LOGIN_KEY;
    expect(codexLoginConfigured()).toBe(false);
    expect(() => sealText("x")).toThrow(/not configured/);
  });
});
