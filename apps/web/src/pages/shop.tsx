import type { ShoppingReason, ShoppingResponse } from "@smart-pantry/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, withToday } from "@/lib/api";
import { useSession } from "@/shell/session";

const labels: Record<ShoppingReason, string> = {
  "below-par": "Below par",
  "favorite-running-low": "Favorite running low",
  "missing-ingredient": "Missing from a near-match",
};

const order: ShoppingReason[] = ["below-par", "favorite-running-low", "missing-ingredient"];

export function ShopPage() {
  const { household } = useSession();
  const queryClient = useQueryClient();
  const shopping = useQuery({
    queryKey: ["shopping", household?.id],
    enabled: Boolean(household),
    queryFn: () => api<ShoppingResponse>(withToday(`/v1/households/${household!.id}/shopping`)),
  });
  const dismiss = useMutation({
    mutationFn: (key: string) =>
      api(`/v1/households/${household!.id}/shopping/dismiss`, {
        method: "POST",
        body: JSON.stringify({ key }),
      }),
    onSuccess: async () => {
      const id = household?.id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shopping", id] }),
        queryClient.invalidateQueries({ queryKey: ["home", id] }),
      ]);
    },
  });

  return (
    <div className="space-y-6" aria-busy={shopping.isLoading}>
      <div>
        <h1 className="font-heading text-2xl font-bold">Shop</h1>
        <p className="text-sm text-muted-foreground">
          {shopping.data?.source === "model"
            ? "Reasons can come from the model. Quantities come from par, favorites, and the catalog."
            : shopping.isLoading
              ? "Building the list…"
              : "This list came from the built-in matcher."}
        </p>
      </div>
      {shopping.isError ? <p role="alert">Could not load the shopping list.</p> : null}
      {shopping.data && shopping.data.needs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to buy right now.</p>
      ) : null}
      {order.map((reason) => {
        const needs = shopping.data?.needs.filter((need) => need.reason === reason) ?? [];
        if (needs.length === 0) return null;
        return (
          <section key={reason} className="space-y-3">
            <h2 className="font-heading text-lg font-bold">{labels[reason]}</h2>
            <ul className="space-y-3">
              {needs.map((need) => (
                <li key={need.key}>
                  <Card className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{need.name}</p>
                      <p className="text-sm text-muted-foreground">{need.detail}</p>
                      <p className="text-sm">
                        Suggested {need.suggestedQuantity} {need.unit}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => dismiss.mutate(need.key)}
                      disabled={dismiss.isPending && dismiss.variables === need.key}
                    >
                      Got it
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
