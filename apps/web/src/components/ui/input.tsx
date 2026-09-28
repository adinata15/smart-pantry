import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Shared surface for inputs, selects, and textareas (clay tokens flip with theme). */
export const controlSurfaceClassName =
  "rounded-2xl border-[3px] border-input-border bg-input text-foreground";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("min-h-11 w-full px-3 transition-colors duration-200", controlSurfaceClassName, className)}
      {...props}
    />
  );
}
