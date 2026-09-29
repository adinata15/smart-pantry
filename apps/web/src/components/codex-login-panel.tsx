import type { CodexConnectSession, CodexLoginStatus } from "@smart-pantry/contracts";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError, api } from "@/lib/api";

const POLL_MS = 1500;

async function invalidateAdviceQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["codex-login"] }),
    queryClient.invalidateQueries({ queryKey: ["home"] }),
    queryClient.invalidateQueries({ queryKey: ["meals"] }),
    queryClient.invalidateQueries({ queryKey: ["shopping"] }),
  ]);
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function CodexLoginPanel() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const status = useQuery({
    queryKey: ["codex-login"],
    queryFn: () => api<CodexLoginStatus>("/v1/me/codex-login"),
  });

  const connectSession = useQuery({
    queryKey: ["codex-login-session", sessionId],
    enabled: Boolean(sessionId),
    refetchInterval: (query) => {
      const liveStatus = query.state.data?.status;
      return liveStatus === "connected" || liveStatus === "failed" ? false : POLL_MS;
    },
    queryFn: () => api<CodexConnectSession>(`/v1/me/codex-login/connect/${sessionId}`),
  });

  useEffect(() => {
    if (connectSession.data?.status !== "connected") return;
    setSessionId(null);
    void invalidateAdviceQueries(queryClient);
  }, [connectSession.data?.status, queryClient]);

  const connect = useMutation({
    mutationFn: () => api<CodexConnectSession>("/v1/me/codex-login/connect", { method: "POST" }),
    onSuccess: (session) => {
      setFormError("");
      setSessionId(session.sessionId);
    },
    onError: (error) => setFormError(apiErrorMessage(error, "Could not start Codex login.")),
  });

  const disconnect = useMutation({
    mutationFn: () => api<{ ok: true }>("/v1/me/codex-login", { method: "DELETE" }),
    onSuccess: async () => {
      setFormError("");
      setSessionId(null);
      await invalidateAdviceQueries(queryClient);
    },
    onError: (error) => setFormError(apiErrorMessage(error, "Could not disconnect Codex.")),
  });

  const live = connectSession.data;
  const awaiting = Boolean(sessionId) && live?.status !== "failed" && live?.status !== "connected";
  const connectedLabel = status.data?.connectedAt
    ? `Connected since ${new Date(status.data.connectedAt).toLocaleString()}.`
    : "Connected.";

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-bold">Codex meal advice</h2>
        <p className="text-sm text-muted-foreground">
          Connect your ChatGPT Codex subscription for model-backed meal and shopping advice. The app never
          shows your login secret.
        </p>
      </div>
      {status.isError ? <p role="alert">Could not load Codex login status.</p> : null}
      {formError ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {formError}
        </p>
      ) : null}
      {live?.status === "failed" && live.error ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {live.error}
        </p>
      ) : null}
      {status.data?.connected ? (
        <div className="space-y-3">
          <p className="text-sm">{connectedLabel}</p>
          <Button
            type="button"
            variant="ghost"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            Disconnect
          </Button>
        </div>
      ) : awaiting ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sign in with ChatGPT. After you approve, the browser may go to 127.0.0.1:1455 — that is Codex
            on this computer finishing the login. This page will update when that succeeds.
          </p>
          {live?.verificationUrl ? (
            <p className="text-sm">
              Open{" "}
              <a
                className="inline break-all font-semibold underline"
                href={live.verificationUrl}
                target="_blank"
                rel="noreferrer"
              >
                {live.verificationUrl}
              </a>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for the verification link…</p>
          )}
          {live?.userCode ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Enter this code on ChatGPT</p>
              <p className="font-mono text-2xl font-bold tracking-widest">{live.userCode}</p>
            </div>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => setSessionId(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {!status.data?.configured ? (
            <p className="text-sm text-muted-foreground">
              This server has no Codex login key configured, so connect is unavailable.
            </p>
          ) : null}
          <Button
            type="button"
            disabled={!status.data?.configured || connect.isPending}
            onClick={() => connect.mutate()}
          >
            Connect ChatGPT Codex
          </Button>
        </div>
      )}
    </Card>
  );
}
