import type { Freshness } from "@smart-pantry/contracts";
import { cn } from "@/lib/cn";

/** Light + dark pairs — intentional `dark:` for semantic freshness colors on glass surfaces */
const styles: Record<Freshness, string> = {
  expired:
    "border-red-300/70 bg-red-50/80 text-red-900 dark:border-red-700/70 dark:bg-red-950/70 dark:text-red-100",
  expiring:
    "border-amber-300/70 bg-amber-50/80 text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/70 dark:text-amber-100",
  fresh:
    "border-emerald-300/70 bg-emerald-50/80 text-emerald-950 dark:border-emerald-700/70 dark:bg-emerald-950/70 dark:text-emerald-100",
  unknown:
    "border-stone-300/70 bg-stone-100/80 text-stone-800 dark:border-stone-500/70 dark:bg-stone-800/70 dark:text-stone-100",
};

const labels: Record<Freshness, string> = {
  expired: "Expired",
  expiring: "Expiring soon",
  fresh: "Fresh",
  unknown: "No date",
};

export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold backdrop-blur-sm",
        styles[freshness],
      )}
    >
      {labels[freshness]}
    </span>
  );
}
