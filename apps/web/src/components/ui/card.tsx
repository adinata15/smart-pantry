import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border-[3px] border-border bg-card p-4 shadow-clay", className)}
      {...props}
    />
  );
}
