import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Shared surface for inputs, selects, and textareas (glass tokens flip with theme). */
export const controlSurfaceClassName = "glass-input rounded-2xl text-foreground";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("min-h-11 w-full px-3 transition-colors duration-200", controlSurfaceClassName, className)}
      {...props}
    />
  );
}
