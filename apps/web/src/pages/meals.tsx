import type { MealsResponse } from "@smart-pantry/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { AgentFetchStatus } from "@/components/agent-fetch-status";
import { CodexLoginPanel } from "@/components/codex-login-panel";
import { Card } from "@/components/ui/card";
import { api, withToday } from "@/lib/api";
import { useSession } from "@/shell/session";

export function MealsPage() {
  const { household } = useSession();
  const meals = useQuery({
    queryKey: ["meals", household?.id],
    enabled: Boolean(household),
    queryFn: () => api<MealsResponse>(withToday(`/v1/households/${household!.id}/meals`)),
  });

  const list = meals.data?.meals ?? [];

  return (
    <div className="space-y-6" aria-busy={meals.isLoading}>
      <div>
        <h1 className="font-heading text-2xl font-bold">Meals</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Nutrition figures come from the catalog. They are estimates, not medical advice.
        </p>
      </div>
      <CodexLoginPanel />
      {meals.isLoading ? (
        <AgentFetchStatus
          title="Fetching meal ideas from the AI agent."
          detail="This can take a moment while Codex reads your stock and matches recipes."
        />
      ) : null}
      {meals.isError ? <p role="alert">Could not load meal ideas.</p> : null}
      {meals.data ? (
        <p className="text-sm font-semibold">
          {meals.data.source === "model"
            ? "These meals came from the model."
            : "These meals came from the built-in matcher."}
        </p>
      ) : null}
      {meals.data && list.length === 0 ? (
        <Card className="space-y-2">
          <p className="text-sm text-muted-foreground">No meal ideas yet for this stock.</p>
          <p className="text-sm">
            <Link to="/fridge" className="font-semibold underline">
              Add stock
            </Link>
          </p>
        </Card>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {list.map((meal) => (
          <Card key={`${meal.recipeId}-${meal.mealType}`} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meal.mealType}</p>
                <h2 className="font-heading text-xl font-bold">{meal.name}</h2>
              </div>
              <p className="text-2xl font-bold">{meal.matchPercent}%</p>
            </div>
            <p className="text-sm leading-6">{meal.advice}</p>
            {meal.nearMatch ? (
              <p className="text-sm font-semibold">Buy {meal.missing.join(", ")} to cook this.</p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <p>On hand: {meal.onHand.length ? meal.onHand.join(", ") : "none"}</p>
              <p>Missing: {meal.missing.length ? meal.missing.join(", ") : "nothing"}</p>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Calories</dt>
                <dd className="font-semibold">{meal.nutrition.calories}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Protein</dt>
                <dd className="font-semibold">{meal.nutrition.protein} g</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Carbs</dt>
                <dd className="font-semibold">{meal.nutrition.carbs} g</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fat</dt>
                <dd className="font-semibold">{meal.nutrition.fat} g</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fiber</dt>
                <dd className="font-semibold">{meal.nutrition.fiber} g</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sodium</dt>
                <dd className="font-semibold">{meal.nutrition.sodium} mg</dd>
              </div>
            </dl>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {meal.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
}
