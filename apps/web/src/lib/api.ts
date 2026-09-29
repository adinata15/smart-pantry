import type { ApiErrorBody } from "@smart-pantry/contracts";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ""}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(response.status, body.error?.message ?? "Request failed.");
  }
  return body as T;
}

export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function withToday(path: string): string {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}today=${localToday()}`;
}

export function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}
