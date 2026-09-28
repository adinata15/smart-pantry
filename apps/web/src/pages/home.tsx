import type { HomeResponse } from "@smart-pantry/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { FreshnessBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api, formatDay, withToday } from "@/lib/api";
import { useSession } from "@/shell/session";

export function HomePage() {
  const { household, user } = useSession();
  const home = useQuery({
    queryKey: ["home", household?.id],
    enabled: Boolean(household),
    queryFn: () => api<HomeResponse>(withToday(`/v1/households/${household!.id}/home`)),
  });

  if (home.isError) return <p role="alert">Could not load the household.</p>;

  const data = home.data;

  return (
    <div className="space-y-6" aria-busy={home.isLoading}>
      <div>
        <h1 className="font-heading text-2xl font-bold">Hello, {user.displayName}</h1>
        <p className="text-sm text-muted-foreground">
          {data ? `Refrigerator snapshot for ${data.householdName}.` : "Loading the kitchen…"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-muted-foreground">In the refrigerator</p>
          <p className="text-3xl font-bold">{data?.refrigerator.length ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Expiring within 3 days</p>
          <p className="text-3xl font-bold">{data?.expiringSoon.length ?? "—"}</p>
          <Link to="/fridge" className="mt-2 inline-flex min-h-11 items-center font-semibold underline">
            Open the fridge
          </Link>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Shopping needs</p>
          <p className="text-3xl font-bold">{data?.shoppingCount ?? "—"}</p>
          <Link to="/shop" className="mt-2 inline-flex min-h-11 items-center font-semibold underline">
            Open the list
          </Link>
        </Card>
      </div>
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold">Expiring soon</h2>
        {!data || home.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data.expiringSoon.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing expires in the next three days.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {data.expiringSoon.map((item) => (
              <li key={item.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.nextExpiry ? formatDay(item.nextExpiry) : "No date"}</p>
                  </div>
                  <FreshnessBadge freshness={item.freshness} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-heading text-lg font-bold">One idea per meal</h2>
          <p className="text-sm text-muted-foreground">
            {data ? (data.source === "model" ? "From the model" : "From the built-in matcher") : "…"}
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {(data?.meals ?? []).map((meal) => (
            <Card key={meal.recipeId}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meal.mealType}</p>
              <h3 className="font-heading mt-1 font-bold">{meal.name}</h3>
              <p className="mt-2 text-sm">{meal.matchPercent}% match</p>
            </Card>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold">Top favorites</h2>
        {!data || home.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data.favorites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Use an item twice, or pin it, and it will show up here.</p>
        ) : (
          <ul className="space-y-2">
            {data.favorites.map((favorite) => (
              <li key={favorite.itemId} className="rounded-2xl border-[3px] border-border bg-card px-3 py-2 text-sm shadow-clay">
                <span className="font-semibold">{favorite.name}</span>
                <span className="text-muted-foreground"> · used {favorite.useCount} times</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
