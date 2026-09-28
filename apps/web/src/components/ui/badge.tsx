import type { Freshness } from "@smart-pantry/contracts";
import { cn } from "@/lib/cn";

/** Light + dark pairs — intentional `dark:` for semantic freshness colors on clay surfaces */
const styles: Record<Freshness, string> = {
  expired:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100",
  expiring:
    "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
  fresh:
    "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
  unknown:
    "border-stone-300 bg-stone-100 text-stone-800 dark:border-stone-500 dark:bg-stone-800 dark:text-stone-100",
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
        "inline-flex items-center rounded-full border-2 px-2 py-0.5 text-xs font-semibold",
        styles[freshness],
      )}
    >
      {labels[freshness]}
    </span>
  );
}
