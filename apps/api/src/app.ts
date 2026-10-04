import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { HttpError } from "./infra/errors";
import { prisma } from "./infra/prisma";
import { createPorts } from "./infra/prisma-ports";
import { redactValue } from "./infra/redact";
import { hashToken } from "./infra/tokens";
import { SESSION_COOKIE } from "./http/cookies";
import { catalogPlugin } from "./modules/catalog/plugin";
import { consumptionPlugin } from "./modules/consumption/plugin";
import { householdPlugin } from "./modules/household/plugin";
import { identityPlugin } from "./modules/identity/plugin";
import { intakePlugin } from "./modules/intake/plugin";
import { inventoryPlugin } from "./modules/inventory/plugin";
import { createKitchenChatModel, createRecommendationModel } from "./modules/recommendations/openai-adapter";
import { recommendationsPlugin } from "./modules/recommendations/plugin";
import { codexLoginPlugin, createCodexLoginService } from "./modules/recommendations/codex-login-plugin";

export async function buildApp() {
  const app = Fastify({
    logger: {
      redact: {
        paths: [
          "req.headers.cookie",
          "req.headers.authorization",
          "req.body.password",
          "req.body.currentPassword",
          "req.body.newPassword",
          "password",
          "currentPassword",
          "newPassword",
          'res.headers["set-cookie"]',
        ],
        censor: "[redacted]",
      },
    },
  });

  app.addHook("onSend", async (_request, _reply, payload) => {
    if (typeof payload === "string") return redactValue(payload);
    return payload;
  });

  const origins = (process.env.WEB_ORIGIN ?? "http://localhost:5173,http://localhost:8080")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cookie);
  await app.register(cors, { origin: origins, credentials: true });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
    }
    request.log.error({ err: redactValue(error instanceof Error ? error.message : "error") }, "request failed");
    return reply.code(500).send({ error: { code: "internal", message: "Something went wrong." } });
  });

  app.get("/v1/health", async () => ({ ok: true }));

  const ports = createPorts(prisma);
  const processModel = createRecommendationModel();
  const processChatModel = createKitchenChatModel();
  const codexLogin = createCodexLoginService(ports);

  await app.register(
    async (api) => {
      api.decorateRequest("user", null);
      api.addHook("onRequest", async (request) => {
        request.user = null;
        const token = request.cookies[SESSION_COOKIE];
        if (!token) return;
        const userId = await ports.findUserIdBySession(hashToken(token));
        if (!userId) return;
        request.user = await ports.findUserById(userId);
      });
      await api.register(identityPlugin(ports));
      await api.register(householdPlugin(ports));
      await api.register(inventoryPlugin(ports));
      await api.register(consumptionPlugin(ports));
      await api.register(intakePlugin(ports));
      await api.register(catalogPlugin());
      await api.register(codexLoginPlugin(ports, codexLogin));
      await api.register(recommendationsPlugin(ports, processModel, processChatModel));
    },
    { prefix: "/v1" },
  );

  return app;
}
