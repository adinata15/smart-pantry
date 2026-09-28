import type { HouseholdSummary } from "@smart-pantry/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorSummary, Field, focusSummary, messageFor, type FieldError } from "@/components/field";
import { ApiError, api } from "@/lib/api";
import { HOUSEHOLD_STORAGE_KEY } from "@/shell/session";

export function SetupHousehold() {
  const queryClient = useQueryClient();
  const createSummary = useRef<HTMLDivElement>(null);
  const joinSummary = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createErrors, setCreateErrors] = useState<FieldError[]>([]);
  const [joinErrors, setJoinErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState("");

  async function refresh(household: HouseholdSummary) {
    localStorage.setItem(HOUSEHOLD_STORAGE_KEY, household.id);
    await queryClient.invalidateQueries({ queryKey: ["households"] });
  }

  const create = useMutation({
    mutationFn: () => api<{ household: HouseholdSummary }>("/v1/households", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: (result) => refresh(result.household),
    onError: (error) => setFormError(error instanceof ApiError ? error.message : "Could not create the household."),
  });

  const join = useMutation({
    mutationFn: () =>
      api<{ household: HouseholdSummary }>("/v1/households/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode }),
      }),
    onSuccess: (result) => refresh(result.household),
    onError: (error) => setFormError(error instanceof ApiError ? error.message : "Could not join that household."),
  });

  function onCreate(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = name.trim() ? [] : [{ id: "household-name", message: "Enter a household name." }];
    setCreateErrors(next);
    setFormError("");
    if (next.length) {
      focusSummary(createSummary);
      return;
    }
    create.mutate();
  }

  function onJoin(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = inviteCode.trim()
      ? []
      : [{ id: "invite-code", message: "Enter an invite code." }];
    setJoinErrors(next);
    setFormError("");
    if (next.length) {
      focusSummary(joinSummary);
      return;
    }
    join.mutate();
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
      <Card className="space-y-4">
        <h1 className="font-heading text-xl font-bold">Start a household</h1>
        <p className="text-sm text-muted-foreground">You will be the owner and can share an invite code.</p>
        <form className="space-y-3" onSubmit={onCreate} noValidate>
          <ErrorSummary ref={createSummary} titleId="setup-create-errors" errors={createErrors} />
          <Field id="household-name" label="Household name" error={messageFor(createErrors, "household-name")}>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Button type="submit" disabled={create.isPending}>
            Create household
          </Button>
        </form>
      </Card>
      <Card className="space-y-4">
        <h2 className="font-heading text-xl font-bold">Join with a code</h2>
        <form className="space-y-3" onSubmit={onJoin} noValidate>
          <ErrorSummary ref={joinSummary} titleId="setup-join-errors" errors={joinErrors} />
          <Field id="invite-code" label="Invite code" error={messageFor(joinErrors, "invite-code")}>
            <Input value={inviteCode} autoCapitalize="characters" onChange={(event) => setInviteCode(event.target.value)} />
          </Field>
          <Button type="submit" variant="accent" disabled={join.isPending}>
            Join household
          </Button>
        </form>
      </Card>
      {formError ? (
        <p role="alert" className="text-sm text-danger-foreground md:col-span-2">
          {formError}
        </p>
      ) : null}
    </div>
  );
}
