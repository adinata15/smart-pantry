import type {
  MealSuggestion,
  MealUseQuantityLine,
  MealsResponse,
  UseMealResponse,
} from "@smart-pantry/contracts";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { AgentFetchStatus } from "@/components/agent-fetch-status";
import { CodexLoginPanel } from "@/components/codex-login-panel";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, api, withToday } from "@/lib/api";
import { useSession } from "@/shell/session";

type ConfirmState = {
  recipeId: string;
  lines: MealUseQuantityLine[];
  values: Record<string, string>;
};

function mealKey(meal: MealSuggestion) {
  return `${meal.recipeId}-${meal.mealType}`;
}

function confirmFromLines(recipeId: string, lines: MealUseQuantityLine[]): ConfirmState {
  return {
    recipeId,
    lines,
    values: Object.fromEntries(
      lines.map((line) => [line.ingredient, line.suggested != null ? String(line.suggested) : ""]),
    ),
  };
}

export function MealsPage() {
  const { household } = useSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [agentRefresh, setAgentRefresh] = useState(false);

  const meals = useQuery({
    queryKey: ["meals", household?.id],
    enabled: Boolean(household),
    queryFn: () => api<MealsResponse>(withToday(`/v1/households/${household!.id}/meals`)),
  });

  // Full agent banner only on first load or explicit Refresh — not after using a meal.
  const showAgentFetch = meals.isFetching && (!meals.data || agentRefresh);
  const data = showAgentFetch ? undefined : meals.data;
  const list = data?.meals ?? [];

  async function refreshStockQueries() {
    const id = household?.id;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["items", id] }),
      queryClient.invalidateQueries({ queryKey: ["home", id] }),
      queryClient.invalidateQueries({ queryKey: ["meals", id] }),
      queryClient.invalidateQueries({ queryKey: ["shopping", id] }),
      queryClient.invalidateQueries({ queryKey: ["favorites", id] }),
    ]);
  }

  async function refreshMealsFromAgent() {
    setAgentRefresh(true);
    try {
      await meals.refetch();
    } finally {
      setAgentRefresh(false);
    }
  }

  const useMealMutation = useMutation({
    mutationFn: (input: { recipeId: string; quantities?: { ingredient: string; quantity: number }[] }) =>
      api<UseMealResponse>(withToday(`/v1/households/${household!.id}/meals/${input.recipeId}/use`), {
        method: "POST",
        body: JSON.stringify(input.quantities ? { quantities: input.quantities } : {}),
      }),
    onSuccess: async (result, variables) => {
      setFormError("");
      if (result.status === "needs-quantity") {
        setConfirm(confirmFromLines(variables.recipeId, result.lines));
        setMessage("Confirm the amounts in the fridge units before stock comes off.");
        return;
      }
      setConfirm(null);
      setMessage("Meal used. Stock came off the soonest-expiring lots.");
      await refreshStockQueries();
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Could not use that meal.");
    },
  });

  function onUse(meal: MealSuggestion) {
    setMessage("");
    setFormError("");
    setConfirm(null);
    useMealMutation.mutate({ recipeId: meal.recipeId });
  }

  function onConfirm(event: FormEvent) {
    event.preventDefault();
    if (!confirm) return;
    const quantities = confirm.lines.map((line) => ({
      ingredient: line.ingredient,
      quantity: Number(confirm.values[line.ingredient]),
    }));
    if (quantities.some((row) => !(row.quantity > 0))) {
      setFormError("Enter a positive amount for each ingredient.");
      return;
    }
    setFormError("");
    useMealMutation.mutate({ recipeId: confirm.recipeId, quantities });
  }

  return (
    <div className="space-y-6" aria-busy={showAgentFetch || useMealMutation.isPending}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Meals</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Nutrition figures come from the catalog. They are estimates, not medical advice.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={!household || showAgentFetch}
          onClick={() => void refreshMealsFromAgent()}
        >
          <ArrowsClockwise aria-hidden="true" className="size-4" weight="bold" />
          Refresh
        </Button>
      </div>
      <CodexLoginPanel />
      {showAgentFetch ? (
        <AgentFetchStatus
          title="Fetching meal ideas from the AI agent."
          detail="This can take a moment while Codex reads your stock and matches recipes."
        />
      ) : null}
      {meals.isError && !showAgentFetch ? <p role="alert">Could not load meal ideas.</p> : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {formError}
        </p>
      ) : null}
      {data ? (
        <p className="text-sm font-semibold">
          {data.source === "model"
            ? "These meals came from the model."
            : "These meals came from the built-in matcher."}
        </p>
      ) : null}
      {data && list.length === 0 ? (
        <Card className="space-y-2">
          <p className="text-sm text-muted-foreground">No meal ideas yet for this stock.</p>
          <p className="text-sm">
            <Link to="/fridge" className="font-semibold underline">
              Add stock
            </Link>
          </p>
        </Card>
      ) : null}
      {data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((meal) => {
            const fullMatch = meal.missing.length === 0;
            const confirming = confirm?.recipeId === meal.recipeId;
            return (
              <Card key={mealKey(meal)} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {meal.mealType}
                    </p>
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
                {confirming && confirm ? (
                  <form className="space-y-3 rounded-2xl border border-border p-3" onSubmit={onConfirm} role="status">
                    <p className="text-sm font-semibold">Confirm amounts in fridge units</p>
                    {confirm.lines.map((line) => (
                      <Field
                        key={line.ingredient}
                        id={`confirm-${meal.recipeId}-${line.ingredient}`}
                        label={`${line.ingredient} (${line.unit}, on hand ${line.onHand})`}
                      >
                        <Input
                          inputMode="decimal"
                          value={confirm.values[line.ingredient] ?? ""}
                          onChange={(event) =>
                            setConfirm({
                              ...confirm,
                              values: { ...confirm.values, [line.ingredient]: event.target.value },
                            })
                          }
                        />
                      </Field>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={useMealMutation.isPending}>
                        Confirm and use
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={useMealMutation.isPending}
                        onClick={() => {
                          setConfirm(null);
                          setMessage("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button
                    type="button"
                    disabled={!fullMatch || useMealMutation.isPending}
                    onClick={() => onUse(meal)}
                  >
                    Use this meal
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
