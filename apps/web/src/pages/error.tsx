import { Leaf, MagnifyingGlass, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

function isNotFound(error: unknown): boolean {
  return error == null || (isRouteErrorResponse(error) && error.status === 404);
}

export function ErrorPage() {
  const error = useRouteError();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const notFound = isNotFound(error);

  const { title, description, Icon } = notFound
    ? {
        title: "This page isn’t here",
        description: "That address doesn’t match a page in Smart Pantry.",
        Icon: MagnifyingGlass,
      }
    : {
        title: "Something went wrong",
        description: "The pantry hit a snag. You can go home or try again.",
        Icon: WarningCircle,
      };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} · Smart Pantry`;
    headingRef.current?.focus();
    return () => {
      document.title = previousTitle;
    };
  }, [title]);

  function tryAgain() {
    window.location.reload();
  }

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
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Icon aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-primary" weight="regular" />
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-heading text-2xl font-bold outline-none"
            >
              {title}
            </h1>
          </div>
          <p role="alert" className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="primary">
            <Link to="/">Go home</Link>
          </Button>
          {!notFound ? (
            <Button type="button" variant="ghost" onClick={tryAgain}>
              Try again
            </Button>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
