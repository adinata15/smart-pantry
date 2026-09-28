import type { HouseholdSummary } from "@smart-pantry/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorSummary, Field, focusSummary, messageFor, type FieldError } from "@/components/field";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/shell/session";

export function HouseholdPanel() {
  const { household, setHouseholdId } = useSession();
  const queryClient = useQueryClient();
  const summary = useRef<HTMLDivElement>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);

  const join = useMutation({
    mutationFn: () =>
      api<{ household: HouseholdSummary }>("/v1/households/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode }),
      }),
    onSuccess: async (result) => {
      setErrors([]);
      setFormError("");
      setHouseholdId(result.household.id);
      setInviteCode("");
      await queryClient.invalidateQueries({ queryKey: ["households"] });
    },
    onError: (error) => setFormError(error instanceof ApiError ? error.message : "Could not join that household."),
  });

  if (!household) return null;

  async function copyInvite() {
    if (!household) return;
    try {
      await navigator.clipboard.writeText(household.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFormError("Could not copy the invite code.");
    }
  }

  function onJoin(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = inviteCode.trim()
      ? []
      : [{ id: "panel-invite", message: "Enter an invite code." }];
    setErrors(next);
    setFormError("");
    if (next.length) {
      focusSummary(summary);
      return;
    }
    join.mutate();
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-bold">Household</h2>
        <p className="text-sm text-muted-foreground">
          Share the invite code, or join another kitchen. Your role is {household.role}.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-sm tracking-wide">{household.inviteCode}</p>
        <Button type="button" variant="ghost" onClick={() => void copyInvite()}>
          {copied ? "Copied" : "Copy invite code"}
        </Button>
      </div>
      <form className="space-y-3" onSubmit={onJoin} noValidate>
        <ErrorSummary ref={summary} titleId="panel-join-errors" errors={errors} />
        {formError ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {formError}
          </p>
        ) : null}
        <Field id="panel-invite" label="Join another household" error={messageFor(errors, "panel-invite")}>
          <Input
            value={inviteCode}
            autoCapitalize="characters"
            onChange={(event) => setInviteCode(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="ghost" disabled={join.isPending}>
          Join
        </Button>
      </form>
    </Card>
  );
}
