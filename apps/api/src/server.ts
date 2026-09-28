import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildApp } from "./app";

function loadEnvFile() {
  for (const candidate of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) {
    if (!existsSync(candidate)) continue;
    for (const line of readFileSync(candidate, "utf8").split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (process.env[key] === undefined) process.env[key] = value;
    }
    return;
  }
}

loadEnvFile();

const port = Number(process.env.API_PORT ?? 3001);
const host = "0.0.0.0";

buildApp()
  .then((app) => app.listen({ port, host }))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Failed to start");
    process.exit(1);
  });
