import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";

export type FieldError = { id: string; message: string };

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  const control = Children.only(children);
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {isValidElement(control)
        ? cloneElement(control as ReactElement<Record<string, unknown>>, {
            id,
            "aria-invalid": Boolean(error),
            "aria-describedby": error ? `${id}-error` : undefined,
          })
        : control}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function messageFor(errors: FieldError[], id: string) {
  return errors.find((error) => error.id === id)?.message;
}

export function focusSummary(summary: RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => summary.current?.focus());
}

export const ErrorSummary = forwardRef<
  HTMLDivElement,
  {
    titleId: string;
    errors: FieldError[];
  }
>(function ErrorSummary({ titleId, errors }, ref) {
  if (errors.length === 0) return null;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby={titleId}
      className="rounded-2xl border-[3px] border-danger-border bg-danger-soft p-3"
    >
      <h2 id={titleId} className="text-sm font-semibold text-danger-foreground">
        There is a problem
      </h2>
      <ul className="mt-2 list-disc pl-5 text-sm text-danger-foreground">
        {errors.map((error) => (
          <li key={error.id}>
            <a href={`#${error.id}`} className="underline">
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
});
