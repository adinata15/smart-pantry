import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border-[3px] border-transparent px-4 text-sm font-semibold shadow-clay transition-[background-color,box-shadow,transform] duration-200 ease-out active:shadow-clay-press disabled:pointer-events-none disabled:shadow-none disabled:grayscale-[0.35]",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-primary-hover",
        accent: "bg-accent text-on-accent hover:bg-accent-hover",
        ghost: "border-border bg-transparent text-foreground shadow-none hover:bg-highlight",
        danger: "bg-destructive text-on-destructive hover:bg-destructive-hover",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({
  variant,
  className,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />;
}
