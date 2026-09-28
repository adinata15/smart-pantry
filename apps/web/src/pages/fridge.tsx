import type { LocationName, PantryItem } from "@smart-pantry/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PushPin } from "@phosphor-icons/react";
import { useRef, useState, type FormEvent } from "react";
import { FreshnessBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlSurfaceClassName, Input } from "@/components/ui/input";
import { ErrorSummary, Field, focusSummary, messageFor, type FieldError } from "@/components/field";
import { ApiError, api, formatDay, withToday } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useSession } from "@/shell/session";

const locations: { id: LocationName; label: string }[] = [
  { id: "refrigerator", label: "Refrigerator" },
  { id: "freezer", label: "Freezer" },
  { id: "pantry", label: "Pantry" },
];

const units = ["each", "g", "kg", "ml", "L", "oz", "lb", "cup"];

export function FridgePage() {
  const { household } = useSession();
  const queryClient = useQueryClient();
  const summary = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState<LocationName>("refrigerator");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [expiry, setExpiry] = useState("");
  const [par, setPar] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState("");

  const items = useQuery({
    queryKey: ["items", household?.id],
    enabled: Boolean(household),
    queryFn: () => api<{ items: PantryItem[] }>(withToday(`/v1/households/${household!.id}/items`)),
  });

  async function refresh() {
    const id = household?.id;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["items", id] }),
      queryClient.invalidateQueries({ queryKey: ["home", id] }),
      queryClient.invalidateQueries({ queryKey: ["meals", id] }),
      queryClient.invalidateQueries({ queryKey: ["shopping", id] }),
      queryClient.invalidateQueries({ queryKey: ["favorites", id] }),
    ]);
  }

  const add = useMutation({
    mutationFn: () =>
      api(withToday(`/v1/households/${household!.id}/items`), {
        method: "POST",
        body: JSON.stringify({
          name,
          unit,
          quantity: Number(quantity),
          location,
          expiryDate: expiry || null,
          parLevel: par ? Number(par) : null,
        }),
      }),
    onSuccess: async () => {
      setName("");
      setQuantity("1");
      setExpiry("");
      setPar("");
      setErrors([]);
      setFormError("");
      setMessage("Item added.");
      await refresh();
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Could not add that item."),
  });

  const useOne = useMutation({
    mutationFn: (itemId: string) =>
      api(withToday(`/v1/households/${household!.id}/items/${itemId}/use`), {
        method: "POST",
        body: JSON.stringify({ quantity: 1 }),
      }),
    onSuccess: async () => {
      setMessage("Used 1. Stock came off the soonest-expiring lot.");
      await refresh();
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Could not use that item."),
  });

  const pin = useMutation({
    mutationFn: (item: PantryItem) =>
      api(withToday(`/v1/households/${household!.id}/items/${item.id}`), {
        method: "PATCH",
        body: JSON.stringify({ pinned: !item.pinned }),
      }),
    onSuccess: refresh,
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Could not update that pin."),
  });

  function onAdd(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = name.trim() ? [] : [{ id: "item-name", message: "Enter an item name." }];
    setErrors(next);
    setFormError("");
    if (next.length) {
      focusSummary(summary);
      return;
    }
    add.mutate();
  }

  const list = items.data?.items ?? [];
  const visible = list.filter((item) => item.lots.some((lot) => lot.location === location && lot.quantity > 0));
  const out = list.filter((item) => item.onHand <= 0);

  return (
    <div className="space-y-6" aria-busy={items.isLoading}>
      <div>
        <h1 className="font-heading text-2xl font-bold">Fridge</h1>
        <p className="text-sm text-muted-foreground">Stock by location. Use takes the soonest-expiring lot first.</p>
      </div>
      <div role="group" aria-label="Storage location" className="flex flex-wrap gap-2">
        {locations.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={location === entry.id}
            className={cn(
              "min-h-11 cursor-pointer rounded-2xl border-[3px] px-4 text-sm font-semibold transition-colors duration-200",
              location === entry.id
                ? "border-transparent bg-primary text-on-primary shadow-clay"
                : "border-border bg-card hover:bg-highlight",
            )}
            onClick={() => setLocation(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <Card>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onAdd} noValidate>
          <div className="md:col-span-2">
            <ErrorSummary ref={summary} titleId="fridge-add-errors" errors={errors} />
          </div>
          <Field id="item-name" label="Item" error={messageFor(errors, "item-name")}>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field id="item-quantity" label="Quantity">
            <Input inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </Field>
          <Field id="item-unit" label="Unit">
            <select
              className={cn("min-h-11 w-full px-3", controlSurfaceClassName)}
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              {units.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </Field>
          <Field id="item-expiry" label="Expiry">
            <Input type="date" value={expiry} onChange={(event) => setExpiry(event.target.value)} />
          </Field>
          <Field id="item-par" label="Par level">
            <Input inputMode="decimal" value={par} placeholder="Optional" onChange={(event) => setPar(event.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={add.isPending}>
              Add item
            </Button>
          </div>
        </form>
      </Card>
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
      {items.isLoading ? <p className="text-muted-foreground">Loading stock…</p> : null}
      {visible.length === 0 && !items.isLoading ? (
        <p className="text-sm text-muted-foreground">Nothing in this location yet. Add an item above.</p>
      ) : null}
      <ul className="grid gap-3 lg:grid-cols-2">
        {visible.map((item) => (
          <li key={item.id}>
            <Card className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading font-bold">{item.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {item.onHand} {item.unit}
                    {item.parLevel != null ? ` · par ${item.parLevel}` : ""}
                  </p>
                </div>
                <FreshnessBadge freshness={item.freshness} />
              </div>
              <ul className="space-y-1 text-sm">
                {item.lots
                  .filter((lot) => lot.location === location)
                  .map((lot) => (
                    <li key={lot.id}>
                      {lot.quantity} {item.unit}
                      {lot.expiryDate ? ` · ${formatDay(lot.expiryDate)}` : " · no date"}
                    </li>
                  ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => useOne.mutate(item.id)} disabled={useOne.isPending}>
                  Use 1
                </Button>
                <Button type="button" variant="ghost" aria-pressed={item.pinned} onClick={() => pin.mutate(item)}>
                  <PushPin aria-hidden="true" className="size-4" weight="regular" />
                  {item.pinned ? "Pinned" : "Pin"}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {out.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-heading font-bold">Out of stock</h2>
          <ul className="text-sm text-muted-foreground">
            {out.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
