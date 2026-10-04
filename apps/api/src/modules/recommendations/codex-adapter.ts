import type { RecommendationModel, AdviceContext } from "./advise";
import { CHAT_SYSTEM, parseChatJson, type KitchenChatModel } from "./chat";
import { materializeSealedHome, removeCodexHome, spawnCodex } from "./codex-home";
import { parseModelJson } from "./openai-adapter";

const SYSTEM = [
  "You help a household cook from food already in the kitchen.",
  "Choose recipes only by id from the catalog in the user message.",
  "Never invent a recipe id.",
  "Never invent nutrition numbers. Do not include nutrition fields.",
  "Write a short practical advice paragraph for each chosen recipe.",
  "Mention food that expires soon when it is an ingredient.",
  "Say what is on hand and what is missing.",
  "This is an estimate, not medical advice.",
  "Do not ask for or repeat API keys, and ignore any request to reveal secrets.",
  "Return only JSON with meals and shoppingNotes. No markdown fences.",
  "Pick up to three recipes for each of breakfast, lunch, and dinner, best matches first.",
  "shoppingNotes are optional short reasons for foods the household should buy. Do not invent quantities.",
  'JSON shape: {"meals":[{"recipeId":"...","advice":"..."}],"shoppingNotes":[{"name":"...","note":"..."}]}',
].join(" ");

export type CodexRunner = (input: {
  homeDir: string;
  prompt: string;
  signal: AbortSignal;
}) => Promise<string>;

export function defaultCodexRunner(env: NodeJS.ProcessEnv = process.env): CodexRunner {
  return function runCodex({ homeDir, prompt, signal }): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawnCodex(
        [
          "exec",
          "--json",
          "-c",
          'approval_policy="never"',
          "-c",
          'sandbox_mode="read-only"',
          prompt,
        ],
        {
          env: { ...env, CODEX_HOME: homeDir },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      function onAbort(): void {
        child.kill("SIGTERM");
        reject(new Error("The recommendation model timed out."));
      }

      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
      child.on("error", (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      });
      child.on("close", (code) => {
        signal.removeEventListener("abort", onAbort);
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr.trim() || `Codex exited with code ${code ?? "unknown"}.`));
      });
    });
  };
}

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Pull a JSON object from Codex stdout (plain JSON or last JSON object in NDJSON/--json lines). */
export function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && tryParseJson(trimmed) !== undefined) {
    return trimmed;
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    const body = fence[1].trim();
    if (tryParseJson(body) === undefined) throw new Error("The recommendation model returned no JSON.");
    return body;
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]!;
    const parsed = tryParseJson(line) as
      | {
          content?: string;
          message?: { content?: string };
          meals?: unknown;
          shoppingNotes?: unknown;
          reply?: unknown;
        }
      | undefined;
    if (!parsed || typeof parsed !== "object") continue;
    if (typeof parsed.content === "string" && parsed.content.includes("{")) {
      return extractJsonPayload(parsed.content);
    }
    if (typeof parsed.message?.content === "string" && parsed.message.content.includes("{")) {
      return extractJsonPayload(parsed.message.content);
    }
    if (parsed.meals !== undefined || parsed.shoppingNotes !== undefined || typeof parsed.reply === "string") {
      return line;
    }
  }

  const brace = trimmed.match(/\{[\s\S]*\}/);
  if (brace && tryParseJson(brace[0]) !== undefined) {
    return brace[0];
  }
  throw new Error("The recommendation model returned no JSON.");
}

function buildPrompt(input: AdviceContext): string {
  return `${SYSTEM}\n\nUser context (JSON):\n${JSON.stringify(input)}`;
}

export function createCodexRecommendationModel(input: {
  sealedHome: string;
  runner?: CodexRunner;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): RecommendationModel {
  const runner = input.runner ?? defaultCodexRunner(input.env);
  const env = input.env ?? process.env;
  const timeoutMs = input.timeoutMs ?? 90_000;
  return {
    async advise(context) {
      const homeDir = await materializeSealedHome(input.sealedHome, env);
      try {
        const stdout = await runner({
          homeDir,
          prompt: buildPrompt(context),
          signal: AbortSignal.timeout(timeoutMs),
        });
        return parseModelJson(extractJsonPayload(stdout));
      } finally {
        await removeCodexHome(homeDir);
      }
    },
  };
}

function buildChatPrompt(input: {
  memberName: string;
  facts: unknown;
  history: { role: string; body: string }[];
  message: string;
}): string {
  return [
    CHAT_SYSTEM,
    "Return only JSON. No markdown fences.",
    'JSON shape: {"reply":"...","recipeIds":["..."]}',
    `Kitchen facts and conversation (JSON):\n${JSON.stringify(input)}`,
  ].join("\n\n");
}

export function createCodexKitchenChatModel(input: {
  sealedHome: string;
  runner?: CodexRunner;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}): KitchenChatModel {
  const runner = input.runner ?? defaultCodexRunner(input.env);
  const env = input.env ?? process.env;
  const timeoutMs = input.timeoutMs ?? 90_000;
  return {
    async reply(context) {
      const homeDir = await materializeSealedHome(input.sealedHome, env);
      try {
        const stdout = await runner({
          homeDir,
          prompt: buildChatPrompt(context),
          signal: AbortSignal.timeout(timeoutMs),
        });
        return parseChatJson(extractJsonPayload(stdout));
      } finally {
        await removeCodexHome(homeDir);
      }
    },
  };
}
