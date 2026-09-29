import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, extname, isAbsolute, join, relative } from "node:path";
import { openSealedText, sealText } from "../../infra/seal";

const AUTH_FILE = "auth.json";
const CONFIG_FILE = "config.toml";

const DEFAULT_CONFIG = [
  'cli_auth_credentials_store = "file"',
  'model_reasoning_effort = "low"',
].join("\n");

export type CodexHomeFiles = Record<string, string>;

export function codexBin(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.CODEX_BIN?.trim() || "codex";
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

/** Node spawn on Windows does not run extensionless npm shims such as `codex`. */
export function resolveCodexCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const raw = codexBin(env);
  if (platform !== "win32") return raw;
  const ext = extname(raw).toLowerCase();
  if (ext === ".cmd" || ext === ".exe" || ext === ".bat" || ext === ".com") return raw;
  return `${raw}.cmd`;
}

function windowsCmdPath(resolved: string, env: NodeJS.ProcessEnv): string {
  if (isAbsolute(resolved)) return resolved;
  const appdata = env.APPDATA;
  if (!appdata) return resolved;
  const name = resolved.toLowerCase().endsWith(".cmd") ? resolved : `${resolved}.cmd`;
  const candidate = join(appdata, "npm", name);
  return existsSync(candidate) ? candidate : resolved;
}

const NPM_CODEX_JS = join("node_modules", "@openai", "codex", "bin", "codex.js");

/**
 * `.cmd` shims are not Win32 executables. Spawn the Node entry they wrap, or cmd.exe.
 */
export function resolveCodexInvocation(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  nodeBin: string = process.execPath,
): { command: string; prefix: string[] } {
  const resolved = resolveCodexCommand(env, platform);
  if (platform !== "win32") return { command: resolved, prefix: [] };

  const cmdPath = windowsCmdPath(resolved, env);
  const script = join(dirname(cmdPath), NPM_CODEX_JS);
  if (existsSync(script)) return { command: nodeBin, prefix: [script] };

  const comspec = env.ComSpec || env.COMSPEC || "cmd.exe";
  return { command: comspec, prefix: ["/d", "/s", "/c", cmdPath] };
}

export function codexSpawnEnv(
  env: NodeJS.ProcessEnv = process.env,
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...env, ...extra };
  if (process.platform === "win32" && next.APPDATA) {
    const npmBin = join(next.APPDATA, "npm");
    const current = next.Path ?? next.PATH ?? "";
    if (!current.toLowerCase().includes(npmBin.toLowerCase())) {
      const combined = `${npmBin}${delimiter}${current}`;
      next.PATH = combined;
      next.Path = combined;
    }
  }
  return next;
}

export function spawnCodex(args: readonly string[], options: SpawnOptions): ChildProcess {
  const env = (options.env as NodeJS.ProcessEnv | undefined) ?? process.env;
  const { command, prefix } = resolveCodexInvocation(env);
  return spawn(command, [...prefix, ...args], {
    windowsHide: true,
    ...options,
    env: codexSpawnEnv(env),
  });
}

export async function createEmptyCodexHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), "sp-codex-"));
  await writeFile(join(home, CONFIG_FILE), `${DEFAULT_CONFIG}\n`, "utf8");
  return home;
}

async function walkFiles(root: string, dir: string = root): Promise<CodexHomeFiles> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: CodexHomeFiles = {};
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await walkFiles(root, full));
    } else if (entry.isFile()) {
      const rel = relative(root, full).replaceAll("\\", "/");
      files[rel] = await readFile(full, "utf8");
    }
  }
  return files;
}

export async function readCodexHomeFiles(home: string): Promise<CodexHomeFiles> {
  return walkFiles(home);
}

export function hasCodexAuth(files: CodexHomeFiles): boolean {
  const auth = files[AUTH_FILE];
  return Boolean(auth && auth.trim().length > 2);
}

export async function sealCodexHome(home: string, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const files = await readCodexHomeFiles(home);
  if (!hasCodexAuth(files)) throw new Error("Codex login did not produce auth material.");
  return sealText(JSON.stringify(files), env);
}

export async function materializeSealedHome(
  sealedHome: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const files = JSON.parse(openSealedText(sealedHome, env)) as CodexHomeFiles;
  const home = await mkdtemp(join(tmpdir(), "sp-codex-run-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(home, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  if (!files[CONFIG_FILE]) {
    await writeFile(join(home, CONFIG_FILE), `${DEFAULT_CONFIG}\n`, "utf8");
  }
  return home;
}

export async function removeCodexHome(home: string): Promise<void> {
  await rm(home, { recursive: true, force: true });
}
