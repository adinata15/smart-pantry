import type { FastifyPluginAsync } from "fastify";
import type { AppPorts } from "../../infra/prisma-ports";
import { HttpError } from "../../infra/errors";
import { codexLoginConfigured } from "../../infra/seal";
import { requireUser } from "../../http/parse";
import { CodexLoginService, defaultCodexCli } from "./codex-login";

export function createCodexLoginService(ports: AppPorts): CodexLoginService {
  return new CodexLoginService(defaultCodexCli(), process.env, async (userId, sealedHome) => {
    await ports.upsertMemberLogin(userId, sealedHome);
  });
}

export function codexLoginPlugin(ports: AppPorts, loginService: CodexLoginService): FastifyPluginAsync {
  return async (app) => {
    app.get("/me/codex-login", async (request) => {
      const user = requireUser(request);
      const login = await ports.findMemberLogin(user.id);
      return {
        connected: Boolean(login),
        configured: codexLoginConfigured(),
        connectedAt: login?.connectedAt.toISOString() ?? null,
      };
    });

    app.post("/me/codex-login/connect", async (request) => {
      const user = requireUser(request);
      if (!codexLoginConfigured()) {
        throw new HttpError(503, "codex_unavailable", "Codex login is not configured on this server.");
      }
      return loginService.start(user.id);
    });

    app.get("/me/codex-login/connect/:sessionId", async (request) => {
      const user = requireUser(request);
      const { sessionId } = request.params as { sessionId: string };
      const session = loginService.get(sessionId, user.id);
      if (!session) throw new HttpError(404, "not_found", "That connect session was not found.");
      return session;
    });

    app.delete("/me/codex-login", async (request) => {
      const user = requireUser(request);
      await ports.deleteMemberLogin(user.id);
      return { ok: true };
    });
  };
}
