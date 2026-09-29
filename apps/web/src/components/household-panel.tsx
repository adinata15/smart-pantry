import type { HouseholdMember, HouseholdSummary } from "@smart-pantry/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorSummary, Field, focusSummary, messageFor, type FieldError } from "@/components/field";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/shell/session";

type SwitchHouseholdFormProps = {
  variant?: "card" | "plain";
  title?: string;
};

export function SwitchHouseholdForm({
  variant = "card",
  title = "Switch household",
}: SwitchHouseholdFormProps) {
  const { user, household, setHouseholdId } = useSession();
  const queryClient = useQueryClient();
  const summary = useRef<HTMLDivElement>(null);
  const [inviteCode, setInviteCode] = useState("");
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

  const switchHousehold = useMutation({
    mutationFn: () =>
      api<{ household: HouseholdSummary }>("/v1/households/switch", {
        method: "POST",
        body: JSON.stringify({
          fromHouseholdId: household!.id,
          inviteCode,
          ...(needsSuccessor && successorUserId ? { successorUserId } : {}),
        }),
      }),
    onSuccess: async (result) => {
      setErrors([]);
      setFormError("");
      setInviteCode("");
      setSuccessorUserId("");
      setHouseholdId(result.household.id);
      await queryClient.invalidateQueries({ queryKey: ["households"] });
      await queryClient.invalidateQueries({ queryKey: ["household-members"] });
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not switch to that household."),
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

  function onSwitch(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = [];
    if (!inviteCode.trim()) next.push({ id: "switch-invite", message: "Enter an invite code." });
    if (needsSuccessor && !successorUserId) {
      next.push({ id: "switch-successor", message: "Choose the next owner before you leave." });
    }
    setErrors(next);
    setFormError("");
    if (next.length) {
      focusSummary(summary);
      return;
    }
    switchHousehold.mutate();
  }

  const helperText = isLastMember
    ? "Entering another invite code leaves this kitchen and closes it. Fridge data stays stored but is no longer available."
    : needsSuccessor
      ? "As owner, choose the next owner before you leave, then enter another household's invite code."
      : "Enter another household's invite code to leave this kitchen and join that one.";

  const body = (
    <>
      <div>
        <h2 className="font-heading text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {helperText} Your role is {active.role}.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-sm tracking-wide">{active.inviteCode}</p>
        <Button type="button" variant="ghost" onClick={() => void copyInvite()}>
          {copied ? "Copied" : "Copy invite code"}
        </Button>
      </div>
      <form className="space-y-3" onSubmit={onSwitch} noValidate>
        <ErrorSummary ref={summary} titleId="switch-household-errors" errors={errors} />
        {formError ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {formError}
          </p>
        ) : null}
        {needsSuccessor ? (
          <Field id="switch-successor" label="Next owner" error={messageFor(errors, "switch-successor")}>
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
        <Field id="switch-invite" label="Invite code" error={messageFor(errors, "switch-invite")}>
          <Input
            value={inviteCode}
            autoCapitalize="characters"
            onChange={(event) => setInviteCode(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="ghost" disabled={switchHousehold.isPending || members.isLoading}>
          {switchHousehold.isPending ? "Switching…" : "Switch household"}
        </Button>
      </form>
    </>
  );

  if (variant === "plain") {
    return <div className="space-y-4">{body}</div>;
  }

  return <Card className="space-y-4">{body}</Card>;
}
