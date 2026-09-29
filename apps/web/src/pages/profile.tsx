import type { PublicUser, UpdateProfileRequest } from "@smart-pantry/contracts";
import { House, User } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorSummary, Field, focusSummary, messageFor, type FieldError } from "@/components/field";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useSession } from "@/shell/session";

function patchProfile(body: UpdateProfileRequest) {
  return api<{ user: PublicUser }>("/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-heading text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function FormFeedback({
  formError,
  saved,
  savedMessage,
}: {
  formError: string;
  saved: boolean;
  savedMessage: string;
}) {
  return (
    <>
      {formError ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {formError}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm font-semibold text-accent">
          {savedMessage}
        </p>
      ) : null}
    </>
  );
}

function AccountForm() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const summary = useRef<HTMLDivElement>(null);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(user.displayName);
    setEmail(user.email);
  }, [user.displayName, user.email]);

  const save = useMutation({
    mutationFn: patchProfile,
    onSuccess: async () => {
      setErrors([]);
      setFormError("");
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => {
      setSaved(false);
      setFormError(error instanceof ApiError ? error.message : "Could not save your account.");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = [];
    if (!displayName.trim()) next.push({ id: "account-name", message: "Enter your name." });
    if (!email.includes("@")) next.push({ id: "account-email", message: "Enter an email address." });
    setErrors(next);
    setFormError("");
    setSaved(false);
    if (next.length) {
      focusSummary(summary);
      return;
    }
    save.mutate({ displayName: displayName.trim(), email: email.trim() });
  }

  return (
    <ProfileSection title="Account" description="Your name and email for this kitchen.">
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <ErrorSummary ref={summary} titleId="account-errors" errors={errors} />
        <FormFeedback formError={formError} saved={saved} savedMessage="Account saved." />
        <Field id="account-name" label="Name" error={messageFor(errors, "account-name")}>
          <Input
            autoComplete="name"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setSaved(false);
            }}
          />
        </Field>
        <Field id="account-email" label="Email" error={messageFor(errors, "account-email")}>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSaved(false);
            }}
          />
        </Field>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save account"}
        </Button>
      </form>
    </ProfileSection>
  );
}

function PasswordForm() {
  const queryClient = useQueryClient();
  const summary = useRef<HTMLDivElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: patchProfile,
    onSuccess: async () => {
      setErrors([]);
      setFormError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => {
      setSaved(false);
      setFormError(error instanceof ApiError ? error.message : "Could not change your password.");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = [];
    if (!currentPassword) next.push({ id: "current-password", message: "Enter your current password." });
    if (newPassword.length < 8) next.push({ id: "new-password", message: "Use at least 8 characters." });
    if (newPassword !== confirmPassword) {
      next.push({ id: "confirm-password", message: "New passwords must match." });
    }
    setErrors(next);
    setFormError("");
    setSaved(false);
    if (next.length) {
      focusSummary(summary);
      return;
    }
    save.mutate({ currentPassword, newPassword });
  }

  return (
    <ProfileSection title="Password" description="Change the password for this account.">
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <ErrorSummary ref={summary} titleId="password-errors" errors={errors} />
        <FormFeedback formError={formError} saved={saved} savedMessage="Password updated." />
        <Field id="current-password" label="Current password" error={messageFor(errors, "current-password")}>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              setSaved(false);
            }}
          />
        </Field>
        <Field id="new-password" label="New password" error={messageFor(errors, "new-password")}>
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setSaved(false);
            }}
          />
        </Field>
        <Field id="confirm-password" label="Confirm new password" error={messageFor(errors, "confirm-password")}>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setSaved(false);
            }}
          />
        </Field>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </ProfileSection>
  );
}

function HouseholdCard() {
  const { households, household, setHouseholdId } = useSession();

  return (
    <ProfileSection
      title="Household"
      description={
        households.length > 1
          ? "Choose which kitchen you are working in."
          : "Your current kitchen for fridge, meals, and shopping."
      }
    >
      {households.length === 0 ? (
        <p className="text-sm text-muted-foreground">You are not in a household yet. Create or join one from the home screen.</p>
      ) : (
        <div className="space-y-2" role="group" aria-label="Switch household">
          {households.map((entry) => {
            const selected = household?.id === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setHouseholdId(entry.id)}
                className={cn(
                  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 text-left text-sm font-semibold transition-colors duration-200",
                  selected
                    ? "border-glass-border bg-highlight text-foreground shadow-glass-soft"
                    : "border-transparent text-muted-foreground hover:bg-highlight/60",
                )}
              >
                <House aria-hidden="true" className="size-5 shrink-0" weight="regular" />
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {entry.role}
                </span>
              </button>
            );
          })}
          {household ? (
            <p role="status" className="text-sm text-muted-foreground">
              Using {household.name}.
            </p>
          ) : null}
        </div>
      )}
    </ProfileSection>
  );
}

export function ProfilePage() {
  const { user } = useSession();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="glass flex size-12 shrink-0 items-center justify-center rounded-2xl">
          <User aria-hidden="true" className="size-6 text-primary" weight="regular" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your account settings for {user.displayName}.
          </p>
        </div>
      </div>
      <AccountForm />
      <PasswordForm />
      <HouseholdCard />
    </div>
  );
}
