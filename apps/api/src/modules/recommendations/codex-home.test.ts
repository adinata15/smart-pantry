import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCodexCommand, resolveCodexInvocation } from "./codex-home";

describe("resolveCodexCommand", () => {
  it("keeps the bare command on non-Windows", () => {
    expect(resolveCodexCommand({ CODEX_BIN: "codex" }, "linux")).toBe("codex");
  });

  it("uses the npm cmd shim on Windows", () => {
    expect(resolveCodexCommand({ CODEX_BIN: "codex" }, "win32")).toBe("codex.cmd");
  });

  it("does not double an explicit Windows extension", () => {
    expect(resolveCodexCommand({ CODEX_BIN: String.raw`C:\npm\codex.cmd` }, "win32")).toBe(
      String.raw`C:\npm\codex.cmd`,
    );
  });
});

describe("resolveCodexInvocation", () => {
  it("runs the Node entry next to an npm cmd shim", () => {
    const root = mkdtempSync(join(tmpdir(), "sp-codex-shim-"));
    const cmd = join(root, "codex.cmd");
    const script = join(root, "node_modules", "@openai", "codex", "bin", "codex.js");
    mkdirSync(join(root, "node_modules", "@openai", "codex", "bin"), { recursive: true });
    writeFileSync(cmd, "");
    writeFileSync(script, "");
    const invocation = resolveCodexInvocation({ CODEX_BIN: cmd }, "win32", "node.exe");
    expect(invocation).toEqual({ command: "node.exe", prefix: [script] });
  });

  it("falls back to cmd.exe when the shim has no Node entry", () => {
    const invocation = resolveCodexInvocation(
      { CODEX_BIN: String.raw`C:\missing\codex.cmd`, ComSpec: String.raw`C:\Windows\System32\cmd.exe` },
      "win32",
    );
    expect(invocation.command).toBe(String.raw`C:\Windows\System32\cmd.exe`);
    expect(invocation.prefix).toEqual(["/d", "/s", "/c", String.raw`C:\missing\codex.cmd`]);
  });
});


describe("resolveCodexCommand", () => {
  it("keeps the bare command on non-Windows", () => {
    expect(resolveCodexCommand({ CODEX_BIN: "codex" }, "linux")).toBe("codex");
  });

  it("uses the npm cmd shim on Windows", () => {
    expect(resolveCodexCommand({ CODEX_BIN: "codex" }, "win32")).toBe("codex.cmd");
  });

  it("does not double an explicit Windows extension", () => {
    expect(resolveCodexCommand({ CODEX_BIN: String.raw`C:\npm\codex.cmd` }, "win32")).toBe(
      String.raw`C:\npm\codex.cmd`,
    );
  });
});
