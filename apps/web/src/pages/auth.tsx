import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Leaf } from "@phosphor-icons/react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorSummary, Field, focusSummary, messageFor, type FieldError } from "@/components/field";
import { ApiError, api } from "@/lib/api";

function AuthLayout({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-2 text-lg font-bold">
        <div className="font-heading flex items-center gap-2">
          <Leaf aria-hidden="true" className="size-6 text-primary" weight="regular" />
          Smart Pantry
        </div>
        <ThemeToggle />
      </div>
      <Card className="space-y-5 p-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">A shared kitchen for the household.</p>
        </div>
        {children}
      </Card>
      <p className="mt-4 text-sm text-muted-foreground">{footer}</p>
    </main>
  );
}

export function SignInPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const summary = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState("");

  const signIn = useMutation({
    mutationFn: () => api("/v1/auth/sign-in", { method: "POST", body: JSON.stringify({ email, password }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    },
    onError: (error) => setFormError(error instanceof ApiError ? error.message : "Could not sign in."),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = [];
    if (!email.includes("@")) next.push({ id: "email", message: "Enter an email address." });
    if (!password) next.push({ id: "password", message: "Enter your password." });
    setErrors(next);
    setFormError("");
    if (next.length) {
      focusSummary(summary);
      return;
    }
    signIn.mutate();
  }

  return (
    <AuthLayout title="Sign in" footer={<Link to="/sign-up" className="font-semibold text-foreground underline">Create an account</Link>}>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <ErrorSummary ref={summary} titleId="sign-in-errors" errors={errors} />
        {formError ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {formError}
          </p>
        ) : null}
        <Field id="email" label="Email" error={messageFor(errors, "email")}>
          <Input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field id="password" label="Password" error={messageFor(errors, "password")}>
          <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={signIn.isPending}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}

export function SignUpPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const summary = useRef<HTMLDivElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState("");

  const signUp = useMutation({
    mutationFn: () =>
      api("/v1/auth/sign-up", {
        method: "POST",
        body: JSON.stringify({ displayName, email, password }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    },
    onError: (error) => setFormError(error instanceof ApiError ? error.message : "Could not create the account."),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = [];
    if (!displayName.trim()) next.push({ id: "name", message: "Enter your name." });
    if (!email.includes("@")) next.push({ id: "email", message: "Enter an email address." });
    if (password.length < 8) next.push({ id: "password", message: "Use at least 8 characters." });
    setErrors(next);
    setFormError("");
    if (next.length) {
      focusSummary(summary);
      return;
    }
    signUp.mutate();
  }

  return (
    <AuthLayout title="Create account" footer={<Link to="/sign-in" className="font-semibold text-foreground underline">Sign in</Link>}>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <ErrorSummary ref={summary} titleId="sign-up-errors" errors={errors} />
        {formError ? (
          <p role="alert" className="text-sm text-danger-foreground">
            {formError}
          </p>
        ) : null}
        <Field id="name" label="Name" error={messageFor(errors, "name")}>
          <Input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </Field>
        <Field id="email" label="Email" error={messageFor(errors, "email")}>
          <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field id="password" label="Password" error={messageFor(errors, "password")}>
          <Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={signUp.isPending}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
