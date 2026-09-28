import type { FavoritesResponse } from "@smart-pantry/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useSession } from "@/shell/session";

export function InsightsPage() {
  const { household } = useSession();
  const favorites = useQuery({
    queryKey: ["favorites", household?.id],
    enabled: Boolean(household),
    queryFn: () => api<FavoritesResponse>(`/v1/households/${household!.id}/favorites`),
  });

  const list = favorites.data?.favorites ?? [];
  const chartData = [...list]
    .sort((a, b) => b.useCount - a.useCount)
    .map((favorite) => ({ name: favorite.name, uses: favorite.useCount }));

  return (
    <div className="space-y-6" aria-busy={favorites.isLoading}>
      <div>
        <h1 className="font-heading text-2xl font-bold">Insights</h1>
        <p className="text-sm text-muted-foreground">Favorites from the last 30 days. A food needs two uses, unless you pin it.</p>
      </div>
      {favorites.isLoading ? <p className="text-muted-foreground">Counting uses…</p> : null}
      {favorites.isError ? <p role="alert">Could not load favorites.</p> : null}
      {!favorites.isLoading && favorites.data && list.length === 0 ? (
        <Card className="space-y-2">
          <p className="text-sm text-muted-foreground">No favorites yet.</p>
          <p className="text-sm">
            <Link to="/fridge" className="font-semibold underline">
              Use an item twice, or pin it in the fridge
            </Link>
            , and it will show up here.
          </p>
        </Card>
      ) : null}
      {chartData.length > 0 ? (
        <Card className="space-y-3">
          <h2 className="font-heading text-lg font-bold">Uses by favorite</h2>
          <div className="h-72 w-full" role="img" aria-label="Bar chart of favorite use counts">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${value} uses`, "Uses"]}
                  contentStyle={{
                    background: "var(--card)",
                    border: "3px solid var(--border)",
                    borderRadius: "1rem",
                    color: "var(--foreground)",
                  }}
                />
                <Bar dataKey="uses" fill="var(--primary)" radius={[0, 8, 8, 0]} label={{ position: "right", fill: "var(--foreground)", fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}
      <ol className="space-y-3">
        {list.map((favorite, index) => (
          <li key={favorite.itemId}>
            <Card className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">#{index + 1}</p>
                <h2 className="font-heading font-bold">{favorite.name}</h2>
                <p className="text-sm text-muted-foreground">Used {favorite.useCount} times in the last 30 days.</p>
              </div>
              {favorite.pinned ? (
                <span className="rounded-full border-2 border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                  Pinned
                </span>
              ) : null}
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
