import type { HouseholdMember } from "@smart-pantry/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ErrorSummary, Field, focusSummary, messageFor, type FieldError } from "@/components/field";
import { ApiError, api } from "@/lib/api";
import { HOUSEHOLD_STORAGE_KEY, useSession } from "@/shell/session";

type PanelVariant = "card" | "plain";

function PanelShell({
  variant,
  children,
}: {
  variant: PanelVariant;
  children: ReactNode;
}) {
  if (variant === "plain") {
    return <div className="space-y-4">{children}</div>;
  }
  return <Card className="space-y-4">{children}</Card>;
}

export function LeaveHouseholdForm({
  variant = "card",
  title = "Leave household",
}: {
  variant?: PanelVariant;
  title?: string;
}) {
  const { user, household, setHouseholdId } = useSession();
  const queryClient = useQueryClient();
  const summary = useRef<HTMLDivElement>(null);
  const [successorUserId, setSuccessorUserId] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);

  const members = useQuery({
    queryKey: ["household-members", household?.id],
    queryFn: () => api<{ members: HouseholdMember[] }>(`/v1/households/${household!.id}/members`),
    enabled: Boolean(household),
  });

  const successors = (members.data?.members ?? []).filter((entry) => entry.userId !== user.id);
  const needsSuccessor = household?.role === "owner" && successors.length > 0;
  const isLastMember = (members.data?.members.length ?? 0) <= 1;

  const leaveHousehold = useMutation({
    mutationFn: () =>
      api<{ ok: true }>("/v1/households/leave", {
        method: "POST",
        body: JSON.stringify({
          householdId: household!.id,
          ...(needsSuccessor && successorUserId ? { successorUserId } : {}),
        }),
      }),
    onSuccess: async () => {
      setErrors([]);
      setFormError("");
      setSuccessorUserId("");
      localStorage.removeItem(HOUSEHOLD_STORAGE_KEY);
      setHouseholdId("");
      await queryClient.invalidateQueries({ queryKey: ["households"] });
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not leave that household."),
  });

  if (!household) return null;

  const active = household;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(active.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFormError("Could not copy the invite code.");
    }
  }

  function onLeave(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = [];
    if (needsSuccessor && !successorUserId) {
      next.push({ id: "leave-successor", message: "Choose the next owner before you leave." });
    }
    setErrors(next);
    setFormError("");
    if (next.length) {
      focusSummary(summary);
      return;
    }
    leaveHousehold.mutate();
  }

  const helperText = isLastMember
    ? "Leaving closes this kitchen. Fridge data stays stored but is no longer available. You can create or join a household afterward."
    : needsSuccessor
      ? "As owner, choose the next owner before you leave. You can create or join a household afterward."
      : "Leave this kitchen. You can create or join a household afterward.";

  return (
    <PanelShell variant={variant}>
      <div>
        <h2 className="font-heading text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {active.name} · your role is {active.role}. {helperText}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-sm tracking-wide">{active.inviteCode}</p>
        <Button type="button" variant="ghost" onClick={() => void copyInvite()}>
          {copied ? "Copied" : "Copy invite code"}
        </Button>
      </div>
      <form className="space-y-3" onSubmit={onLeave} noValidate>
        <ErrorSummary ref={summary} titleId="leave-household-errors" errors={errors} />
        {formError ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {formError}
          </p>
        ) : null}
        {needsSuccessor ? (
          <Field id="leave-successor" label="Next owner" error={messageFor(errors, "leave-successor")}>
            <Select
              aria-label="Next owner"
              value={successorUserId}
              onChange={setSuccessorUserId}
              options={[
                { value: "", label: "Choose a member" },
                ...successors.map((entry) => ({
                  value: entry.userId,
                  label: `${entry.displayName}${entry.role === "owner" ? " (owner)" : ""}`,
                })),
              ]}
            />
          </Field>
        ) : null}
        <Button type="submit" variant="ghost" disabled={leaveHousehold.isPending || members.isLoading}>
          {leaveHousehold.isPending ? "Leaving…" : "Leave household"}
        </Button>
      </form>
    </PanelShell>
  );
}
