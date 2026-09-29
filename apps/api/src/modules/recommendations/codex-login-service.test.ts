import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChildProcess } from "node:child_process";
import { CodexLoginService, type CodexCli } from "./codex-login";

const originalKey = process.env.CODEX_LOGIN_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.CODEX_LOGIN_KEY;
  else process.env.CODEX_LOGIN_KEY = originalKey;
});

function fakeChild(): ChildProcess {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = new EventEmitter() as ChildProcess;
  Object.defineProperty(child, "stdout", { value: stdout });
  Object.defineProperty(child, "stderr", { value: stderr });
  Object.defineProperty(child, "stdin", { value: new PassThrough() });
  Object.defineProperty(child, "killed", { value: false, writable: true });
  child.kill = (() => {
    Object.defineProperty(child, "killed", { value: true });
    return true;
  }) as ChildProcess["kill"];
  return child;
}

describe("CodexLoginService", () => {
  it("surfaces the device code and seals auth when login succeeds", async () => {
    process.env.CODEX_LOGIN_KEY = "test-seal-key-value-16";
    const upserts: { userId: string; sealedHome: string }[] = [];
    let child: ChildProcess | null = null;
    const cli: CodexCli = {
      spawnLogin(homeDir) {
        child = fakeChild();
        void (async () => {
          await mkdir(homeDir, { recursive: true });
          child!.stdout!.emit(
            "data",
            Buffer.from("Visit https://auth.openai.com/codex/device and enter code: WXYZ-1234\n"),
          );
          await writeFile(join(homeDir, "auth.json"), '{"tokens":{"access_token":"tok"}}', "utf8");
          child!.emit("close", 0);
        })();
        return child;
      },
    };
    const service = new CodexLoginService(cli, process.env, async (userId, sealedHome) => {
      upserts.push({ userId, sealedHome });
    });

    const started = await service.start("user-1");
    expect(started.sessionId).toBeTruthy();

    await vi.waitFor(() => {
      const view = service.get(started.sessionId, "user-1");
      expect(view?.status).toBe("connected");
      expect(view?.userCode).toBe("WXYZ-1234");
      expect(view?.verificationUrl).toBe("https://auth.openai.com/codex/device");
    });
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.userId).toBe("user-1");
    expect(upserts[0]?.sealedHome).not.toContain("access_token");
  });
});
