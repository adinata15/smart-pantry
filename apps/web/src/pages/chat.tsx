import type { AdviceSource, ChatThreadResponse, ChatTurn, SendChatResponse } from "@smart-pantry/contracts";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AgentFetchStatus } from "@/components/agent-fetch-status";
import { CodexLoginPanel } from "@/components/codex-login-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, api, withToday } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useSession } from "@/shell/session";

const STARTERS = ["What should we cook tonight?", "What expires soon?", "What should we buy?"];

export function ChatPage() {
  const { household } = useSession();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [formError, setFormError] = useState("");
  const [lastSource, setLastSource] = useState<AdviceSource | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const thread = useQuery({
    queryKey: ["chat", household?.id],
    enabled: Boolean(household),
    queryFn: () => api<ChatThreadResponse>(withToday(`/v1/households/${household!.id}/chat`)),
  });

  const send = useMutation({
    mutationFn: (message: string) =>
      api<SendChatResponse>(withToday(`/v1/households/${household!.id}/chat`), {
        method: "POST",
        body: JSON.stringify({ text: message }),
      }),
    onMutate: async (message) => {
      setFormError("");
      setText("");
      const pending: ChatTurn = {
        id: `pending-${Date.now()}`,
        role: "member",
        body: message,
        createdAt: new Date().toISOString(),
      };
      await queryClient.cancelQueries({ queryKey: ["chat", household?.id] });
      const previous = queryClient.getQueryData<ChatThreadResponse>(["chat", household?.id]);
      queryClient.setQueryData<ChatThreadResponse>(["chat", household?.id], {
        turns: [...(previous?.turns ?? []), pending],
      });
      return { previous };
    },
    onSuccess: (result) => {
      setLastSource(result.source);
      queryClient.setQueryData<ChatThreadResponse>(["chat", household?.id], (current) => ({
        turns: [...(current?.turns ?? []).filter((turn) => !turn.id.startsWith("pending-")), ...result.turns],
      }));
    },
    onError: (error, _message, context) => {
      if (context?.previous) queryClient.setQueryData(["chat", household?.id], context.previous);
      setFormError(error instanceof ApiError ? error.message : "Could not send that message.");
    },
  });

  const turns = thread.data?.turns ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, send.isPending]);

  function submit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || send.isPending || !household) return;
    setFormError("");
    send.mutate(trimmed);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit(text);
  }

  return (
    <div className="space-y-6" aria-busy={thread.isLoading || send.isPending}>
      <div>
        <h1 className="font-heading text-2xl font-bold">Chat</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ask what to cook, use, or buy. Replies use this household&apos;s kitchen. Nutrition figures are estimates, not
          medical advice.
        </p>
      </div>
      <CodexLoginPanel />
      {thread.isLoading ? <p className="text-muted-foreground">Loading the kitchen chat…</p> : null}
      {thread.isError ? <p role="alert">Could not load the kitchen chat.</p> : null}
      {send.isPending ? (
        <AgentFetchStatus
          title="Asking the pantry."
          detail="This can take a moment while the reply is grounded in your stock and recipes."
        />
      ) : null}
      {formError ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {formError}
        </p>
      ) : null}
      {lastSource ? (
        <p className="text-sm font-semibold">
          {lastSource === "model"
            ? "That reply came from the model."
            : "That reply came from the built-in kitchen briefing."}
        </p>
      ) : null}
      <section aria-label="Kitchen chat" className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto">
        {thread.data && turns.length === 0 && !send.isPending ? (
          <Card className="space-y-3">
            <p className="text-sm text-muted-foreground">No messages yet. Start with a question about the kitchen.</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((starter) => (
                <Button key={starter} type="button" variant="ghost" disabled={!household} onClick={() => submit(starter)}>
                  {starter}
                </Button>
              ))}
            </div>
          </Card>
        ) : null}
        {turns.map((turn) => (
          <Turn key={turn.id} turn={turn} />
        ))}
        <div ref={endRef} />
      </section>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="chat-text">
          Message
        </label>
        <Input
          id="chat-text"
          name="text"
          value={text}
          maxLength={2000}
          placeholder="Ask about meals, expiry, or shopping"
          onChange={(event) => setText(event.target.value)}
          disabled={!household || thread.isLoading || send.isPending}
        />
        <Button type="submit" disabled={!household || thread.isLoading || send.isPending || text.trim().length === 0}>
          <PaperPlaneTilt aria-hidden="true" className="size-4" weight="regular" />
          Send
        </Button>
      </form>
    </div>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  const fromMember = turn.role === "member";
  return (
    <div className={cn("flex", fromMember ? "justify-end" : "justify-start")}>
      <Card className={cn("max-w-[85%] space-y-1", fromMember ? "bg-highlight" : "")}>
        <p className="text-xs font-semibold text-muted-foreground">{fromMember ? "You" : "Pantry"}</p>
        <p className="whitespace-pre-wrap text-sm">{turn.body}</p>
      </Card>
    </div>
  );
}
