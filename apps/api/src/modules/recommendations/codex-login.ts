import type { ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  createEmptyCodexHome,
  hasCodexAuth,
  readCodexHomeFiles,
  removeCodexHome,
  sealCodexHome,
  spawnCodex,
} from "./codex-home";

export type ConnectStatus = "starting" | "awaiting" | "connected" | "failed";

export interface ConnectSessionView {
  sessionId: string;
  status: ConnectStatus;
  verificationUrl: string | null;
  userCode: string | null;
  error: string | null;
}

interface ConnectSession {
  sessionId: string;
  userId: string;
  homeDir: string;
  status: ConnectStatus;
  verificationUrl: string | null;
  userCode: string | null;
  error: string | null;
  child: ChildProcess | null;
  createdAt: number;
}

export interface CodexCli {
  spawnLogin(homeDir: string): ChildProcess;
}

export function defaultCodexCli(env: NodeJS.ProcessEnv = process.env): CodexCli {
  return {
    spawnLogin(homeDir) {
      return spawnCodex(["login"], {
        env: { ...env, CODEX_HOME: homeDir, NO_COLOR: "1", FORCE_COLOR: "0", TERM: "dumb" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    },
  };
}

export function stripAnsi(text: string): string {
  return text
    .replace(/\u001B\]8;;(.*?)\u001B\\/g, "$1")
    .replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g, "")
    .replace(/\u001B[@-Z\\-_]/g, "");
}

export function parseDeviceAuthOutput(text: string): {
  verificationUrl: string | null;
  userCode: string | null;
} {
  const clean = stripAnsi(text);
  const urlChars = /https?:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[a-z0-9._~:/?#@!$&'()*+,;=%-]*)?/gi;
  const urls = clean.match(urlChars) ?? [];
  const authorize = urls.find((url) => /\/oauth\/authorize\?/i.test(url));
  const device = urls.find((url) => /\/codex\/device/i.test(url));
  const codeMatch = clean.match(/\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/);
  return {
    verificationUrl: authorize ?? device ?? urls[0] ?? null,
    userCode: authorize ? null : (codeMatch?.[1] ?? null),
  };
}

const SESSION_TTL_MS = 15 * 60 * 1000;

function isActiveStatus(status: ConnectStatus): boolean {
  return status === "starting" || status === "awaiting";
}

export class CodexLoginService {
  private readonly sessions = new Map<string, ConnectSession>();

  constructor(
    private readonly cli: CodexCli = defaultCodexCli(),
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly onConnected: (userId: string, sealedHome: string) => Promise<void>,
  ) {}

  private prune(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt < SESSION_TTL_MS) continue;
      void this.abort(id);
    }
  }

  private view(session: ConnectSession): ConnectSessionView {
    return {
      sessionId: session.sessionId,
      status: session.status,
      verificationUrl: session.verificationUrl,
      userCode: session.userCode,
      error: session.error,
    };
  }

  private abortActiveForUser(userId: string): void {
    for (const [id, existing] of this.sessions) {
      if (existing.userId === userId && isActiveStatus(existing.status)) {
        void this.abort(id);
      }
    }
  }

  private attachOutput(session: ConnectSession, child: ChildProcess): void {
    let buffer = "";
    const onChunk = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const parsed = parseDeviceAuthOutput(buffer);
      if (parsed.verificationUrl) session.verificationUrl = parsed.verificationUrl;
      if (parsed.userCode) session.userCode = parsed.userCode;
      if (session.status === "starting" && (session.verificationUrl || session.userCode)) {
        session.status = "awaiting";
      }
    };
    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
  }

  private async finishLogin(session: ConnectSession, code: number | null): Promise<void> {
    try {
      if (code === 0) {
        const files = await readCodexHomeFiles(session.homeDir);
        if (!hasCodexAuth(files)) throw new Error("Codex login finished without credentials.");
        const sealed = await sealCodexHome(session.homeDir, this.env);
        await this.onConnected(session.userId, sealed);
        session.status = "connected";
        session.error = null;
      } else if (session.status !== "connected") {
        session.status = "failed";
        session.error = session.error ?? "Codex login did not finish.";
      }
    } catch (error) {
      session.status = "failed";
      session.error = error instanceof Error ? error.message : "Codex login failed.";
    } finally {
      await removeCodexHome(session.homeDir);
      session.child = null;
    }
  }

  async start(userId: string): Promise<ConnectSessionView> {
    this.prune();
    this.abortActiveForUser(userId);

    const sessionId = randomBytes(16).toString("hex");
    const homeDir = await createEmptyCodexHome();
    const session: ConnectSession = {
      sessionId,
      userId,
      homeDir,
      status: "starting",
      verificationUrl: null,
      userCode: null,
      error: null,
      child: null,
      createdAt: Date.now(),
    };
    this.sessions.set(sessionId, session);

    let child: ChildProcess;
    try {
      child = this.cli.spawnLogin(homeDir);
    } catch (error) {
      session.status = "failed";
      session.error = error instanceof Error ? error.message : "Could not start Codex login.";
      await removeCodexHome(homeDir);
      return this.view(session);
    }

    session.child = child;
    this.attachOutput(session, child);

    child.on("error", (error) => {
      session.status = "failed";
      session.error = error.message;
      void removeCodexHome(homeDir);
    });

    child.on("close", (code) => {
      void this.finishLogin(session, code);
    });

    return this.view(session);
  }

  get(sessionId: string, userId: string): ConnectSessionView | null {
    this.prune();
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) return null;
    return this.view(session);
  }

  async abort(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.child && !session.child.killed) {
      session.child.kill("SIGTERM");
    }
    await removeCodexHome(session.homeDir);
    this.sessions.delete(sessionId);
  }
}
