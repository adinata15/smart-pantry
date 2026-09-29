import { CircleNotch } from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";

type AgentFetchStatusProps = {
  title: string;
  detail: string;
};

export function AgentFetchStatus({ title, detail }: AgentFetchStatusProps) {
  return (
    <Card role="status" aria-live="polite" className="flex items-center gap-4">
      <CircleNotch
        aria-hidden="true"
        className="size-8 shrink-0 animate-spin text-primary motion-reduce:animate-none"
        weight="regular"
      />
      <div className="min-w-0 space-y-1">
        <p className="font-heading text-base font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </Card>
  );
}
