const SECRET_ENV = ["OPENAI_API_KEY", "DATABASE_URL"];

export function redactValue<T>(value: T): T {
  const secrets = SECRET_ENV.map((name) => process.env[name]).filter(
    (secret): secret is string => Boolean(secret && secret.length >= 8),
  );
  if (secrets.length === 0) return value;
  return scrub(value, secrets) as T;
}

function scrub(value: unknown, secrets: string[]): unknown {
  if (typeof value === "string") {
    return secrets.reduce((text, secret) => text.split(secret).join("[redacted]"), value);
  }
  if (Array.isArray(value)) return value.map((entry) => scrub(entry, secrets));
  if (value && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      copy[key] = scrub(entry, secrets);
    }
    return copy;
  }
  return value;
}

export function stripSecrets(text: string): string {
  return redactValue(text);
}
