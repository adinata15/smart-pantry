import type { Freshness, ItemCategory, LocationName, PantryItem, StockLot } from "@smart-pantry/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PushPin } from "@phosphor-icons/react";
import { useMemo, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { FreshnessBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ErrorSummary, Field, focusSummary, messageFor, type FieldError } from "@/components/field";
import { ApiError, api, formatDay, isoToDmy, localToday, withToday } from "@/lib/api";
import { categoryMeta, categoryOptions } from "@/lib/categories";
import { dmyToIso, maskDmy } from "@/lib/dates";
import { cn } from "@/lib/cn";
import {
  elsewhereLine,
  expiryLine,
  freshnessOf,
  locationFreshness,
  locationQuantity,
  lotsInLocation,
  shortFreshness,
} from "@/lib/freshness";
import { useSession } from "@/shell/session";

const locations: { id: LocationName; label: string }[] = [
  { id: "refrigerator", label: "Refrigerator" },
  { id: "freezer", label: "Freezer" },
  { id: "pantry", label: "Pantry" },
];

const categorySelectOptions = categoryOptions.map((option) => ({
  value: option.id,
  label: option.label,
}));

const units = ["each", "g", "kg", "ml", "L", "oz", "lb", "cup"];

type FreshnessFilter = "all" | Freshness;

const freshnessFilters: { id: FreshnessFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "expired", label: "Expired" },
  { id: "expiring", label: "Expiring soon" },
  { id: "unknown", label: "No date" },
  { id: "fresh", label: "Fresh" },
];

type LocationView = {
  item: PantryItem;
  lots: StockLot[];
  quantity: number;
  freshness: Freshness;
  nextExpiry: string | null;
  elsewhere: string | null;
};

type LotDraft = { id: string; quantity: string; expiry: string };

type GroupId = "attention" | "unknown" | "fresh";

const groupOrder: GroupId[] = ["attention", "unknown", "fresh"];

const groupTitles: Record<GroupId, string> = {
  attention: "Needs attention",
  unknown: "No date",
  fresh: "Fresh",
};

function groupFor(freshness: Freshness): GroupId {
  if (freshness === "expired" || freshness === "expiring") return "attention";
  if (freshness === "unknown") return "unknown";
  return "fresh";
}

function sortViews(a: LocationView, b: LocationView): number {
  const aExpired = a.freshness === "expired";
  const bExpired = b.freshness === "expired";
  if (aExpired !== bExpired) return aExpired ? -1 : 1;

  if (a.nextExpiry && b.nextExpiry && a.nextExpiry !== b.nextExpiry) {
    return a.nextExpiry < b.nextExpiry ? -1 : 1;
  }
  if (Boolean(a.nextExpiry) !== Boolean(b.nextExpiry)) {
    return a.nextExpiry ? -1 : 1;
  }
  return a.item.name.localeCompare(b.item.name);
}

function useLabel(unit: string): string {
  return unit === "each" ? "Use 1" : `Use 1 ${unit}`;
}

function validateName(value: string): string | undefined {
  return value.trim() ? undefined : "Enter an item name.";
}

function validateQuantity(value: string): string | undefined {
  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number) || number <= 0) {
    return "Enter a quantity greater than zero.";
  }
  return undefined;
}

function validateExpiry(value: string): string | undefined {
  if (!value.trim()) return undefined;
  return dmyToIso(value) ? undefined : "Enter the expiry as dd/mm/yyyy.";
}

function FilterChip({
  pressed,
  onClick,
  className,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "min-h-11 cursor-pointer rounded-2xl border text-sm font-semibold transition-colors duration-200",
        className,
        pressed
          ? "border-transparent bg-primary text-on-primary shadow-glass-soft"
          : "glass hover:bg-highlight",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CategorySelect({
  value,
  onChange,
  ...props
}: {
  value: ItemCategory;
  onChange: (value: ItemCategory) => void;
} & Omit<ComponentProps<typeof Select>, "value" | "onChange" | "options">) {
  return (
    <Select
      {...props}
      value={value}
      onChange={(next) => onChange(next as ItemCategory)}
      options={categorySelectOptions}
    />
  );
}

function FridgeItemCard({
  view,
  today,
  editing,
  editName,
  editLots,
  editErrors,
  categoryPending,
  savePending,
  usePending,
  onEditNameChange,
  onBlurEditField,
  onLotField,
  onCategoryChange,
  onSave,
  onCancel,
  onStartEdit,
  onUse,
  onPin,
}: {
  view: LocationView;
  today: string;
  editing: boolean;
  editName: string;
  editLots: LotDraft[];
  editErrors: FieldError[];
  categoryPending: boolean;
  savePending: boolean;
  usePending: boolean;
  onEditNameChange: (value: string) => void;
  onBlurEditField: () => void;
  onLotField: (lotId: string, field: "quantity" | "expiry", value: string) => void;
  onCategoryChange: (category: ItemCategory) => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
  onUse: () => void;
  onPin: () => void;
}) {
  const meta = categoryMeta(view.item.category);
  const CategoryIcon = meta.Icon;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CategoryIcon aria-hidden="true" className="size-4 shrink-0" weight="regular" />
            <span>{meta.label}</span>
            {view.item.pinned ? (
              <PushPin aria-hidden="true" className="size-4 shrink-0 text-primary" weight="fill" />
            ) : null}
          </div>
          {editing ? (
            <Field
              id={`edit-name-${view.item.id}`}
              label="Name"
              error={messageFor(editErrors, `edit-name-${view.item.id}`)}
            >
              <Input value={editName} onChange={(event) => onEditNameChange(event.target.value)} onBlur={onBlurEditField} />
            </Field>
          ) : (
            <h3 className="font-heading line-clamp-2 font-bold">{view.item.name}</h3>
          )}
          <p className="text-2xl font-bold tracking-tight">
            {view.quantity} {view.item.unit}
          </p>
          {view.item.parLevel != null ? (
            <p className="text-sm text-muted-foreground">par {view.item.parLevel}</p>
          ) : null}
          {view.elsewhere ? <p className="text-sm text-muted-foreground">{view.elsewhere}</p> : null}
        </div>
        <FreshnessBadge freshness={view.freshness} />
      </div>

      {!editing ? <p className="text-sm text-muted-foreground">{expiryLine(view.nextExpiry, today)}</p> : null}

      {editing ? (
        <ul className="space-y-3">
          {editLots.map((lot) => (
            <li key={lot.id} className="grid gap-2 sm:grid-cols-2">
              <Field id={`edit-qty-${lot.id}`} label="Quantity" error={messageFor(editErrors, `edit-qty-${lot.id}`)}>
                <Input
                  inputMode="decimal"
                  value={lot.quantity}
                  onChange={(event) => onLotField(lot.id, "quantity", event.target.value)}
                  onBlur={onBlurEditField}
                />
              </Field>
              <Field id={`edit-expiry-${lot.id}`} label="Expiry" error={messageFor(editErrors, `edit-expiry-${lot.id}`)}>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="dd/mm/yyyy"
                  maxLength={10}
                  value={lot.expiry}
                  onChange={(event) => onLotField(lot.id, "expiry", maskDmy(event.target.value))}
                  onBlur={onBlurEditField}
                />
              </Field>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1 text-sm">
          {view.lots.map((lot) => (
            <li key={lot.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                {lot.quantity} {view.item.unit}
              </span>
              <span className="text-muted-foreground">{lot.expiryDate ? formatDay(lot.expiryDate) : "no date"}</span>
              <span className="text-muted-foreground">{shortFreshness(freshnessOf(lot.expiryDate, today))}</span>
            </li>
          ))}
        </ul>
      )}

      <Field id={`item-category-${view.item.id}`} label="Category">
        <CategorySelect value={view.item.category} disabled={categoryPending} onChange={onCategoryChange} />
      </Field>

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button type="button" onClick={onSave} disabled={savePending}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={onUse} disabled={usePending}>
              {useLabel(view.item.unit)}
            </Button>
            <Button type="button" variant="ghost" onClick={onStartEdit}>
              Edit
            </Button>
            <Button type="button" variant="ghost" aria-pressed={view.item.pinned} onClick={onPin}>
              <PushPin aria-hidden="true" className="size-4" weight={view.item.pinned ? "fill" : "regular"} />
              {view.item.pinned ? "Pinned" : "Pin"}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

export function FridgePage() {
  const { household } = useSession();
  const queryClient = useQueryClient();
  const summary = useRef<HTMLDivElement>(null);
  const today = localToday();
  const [location, setLocation] = useState<LocationName>("refrigerator");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [category, setCategory] = useState<ItemCategory>("other");
  const [expiry, setExpiry] = useState("");
  const [par, setPar] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [freshnessFilter, setFreshnessFilter] = useState<FreshnessFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLots, setEditLots] = useState<LotDraft[]>([]);
  const [editErrors, setEditErrors] = useState<FieldError[]>([]);

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
    mutationFn: (expiryDate: string | null) =>
      api(withToday(`/v1/households/${household!.id}/items`), {
        method: "POST",
        body: JSON.stringify({
          name,
          unit,
          category,
          quantity: Number(quantity),
          location,
          expiryDate,
          parLevel: par ? Number(par) : null,
        }),
      }),
    onSuccess: async () => {
      setName("");
      setQuantity("1");
      setExpiry("");
      setPar("");
      setCategory("other");
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

  const patchItem = useMutation({
    mutationFn: (input: { itemId: string; body: Record<string, unknown> }) =>
      api(withToday(`/v1/households/${household!.id}/items/${input.itemId}`), {
        method: "PATCH",
        body: JSON.stringify(input.body),
      }),
    onSuccess: refresh,
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Could not update that item."),
  });

  const patchLot = useMutation({
    mutationFn: (input: { lotId: string; body: Record<string, unknown> }) =>
      api(withToday(`/v1/households/${household!.id}/lots/${input.lotId}`), {
        method: "PATCH",
        body: JSON.stringify(input.body),
      }),
    onSuccess: refresh,
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Could not update that lot."),
  });

  function onAdd(event: FormEvent) {
    event.preventDefault();
    const next: FieldError[] = [];
    const nameError = validateName(name);
    if (nameError) next.push({ id: "item-name", message: nameError });
    const expiryError = validateExpiry(expiry);
    if (expiryError) next.push({ id: "item-expiry", message: expiryError });

    setErrors(next);
    setFormError("");
    if (next.length) {
      focusSummary(summary);
      return;
    }
    add.mutate(expiry.trim() ? dmyToIso(expiry) : null);
  }

  const list = items.data?.items ?? [];
  const out = list.filter((item) => item.onHand <= 0);

  const locationViews = useMemo(() => {
    return list
      .map((item) => {
        const lots = lotsInLocation(item, location);
        if (lots.length === 0) return null;
        const { freshness, nextExpiry } = locationFreshness(lots, today);
        return {
          item,
          lots,
          quantity: locationQuantity(lots),
          freshness,
          nextExpiry,
          elsewhere: elsewhereLine(item, location),
        } satisfies LocationView;
      })
      .filter((view): view is LocationView => view != null)
      .sort(sortViews);
  }, [list, location, today]);

  const filteredViews = useMemo(() => {
    const query = search.trim().toLowerCase();
    return locationViews.filter((view) => {
      if (freshnessFilter !== "all" && view.freshness !== freshnessFilter) return false;
      if (query && !view.item.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [locationViews, search, freshnessFilter]);

  const groups = useMemo(() => {
    const buckets: Record<GroupId, LocationView[]> = {
      attention: [],
      unknown: [],
      fresh: [],
    };
    for (const view of filteredViews) {
      buckets[groupFor(view.freshness)].push(view);
    }
    return groupOrder
      .map((id) => ({ id, title: groupTitles[id], items: buckets[id] }))
      .filter((group) => group.items.length > 0);
  }, [filteredViews]);

  const attentionCount = locationViews.filter(
    (view) => view.freshness === "expiring" || view.freshness === "expired",
  ).length;
  const emptyLocation = locationViews.length === 0 && !items.isLoading;
  const emptyMatches = locationViews.length > 0 && filteredViews.length === 0;
  const freshnessFilterLabel =
    freshnessFilters.find((entry) => entry.id === freshnessFilter)?.label.toLowerCase() ?? "matching";

  function startEdit(view: LocationView) {
    setEditingId(view.item.id);
    setEditName(view.item.name);
    setEditLots(
      view.lots.map((lot) => ({
        id: lot.id,
        quantity: String(lot.quantity),
        expiry: isoToDmy(lot.expiryDate),
      })),
    );
    setEditErrors([]);
    setFormError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditLots([]);
    setEditErrors([]);
  }

  function setLotField(lotId: string, field: "quantity" | "expiry", value: string) {
    setEditLots((current) =>
      current.map((lot) => (lot.id === lotId ? { ...lot, [field]: value } : lot)),
    );
  }

  function collectEditErrors(nameValue: string, lots: LotDraft[]): FieldError[] {
    const next: FieldError[] = [];
    const nameError = validateName(nameValue);
    if (nameError) next.push({ id: `edit-name-${editingId}`, message: nameError });
    for (const lot of lots) {
      const quantityError = validateQuantity(lot.quantity);
      if (quantityError) next.push({ id: `edit-qty-${lot.id}`, message: quantityError });
      const expiryError = validateExpiry(lot.expiry);
      if (expiryError) next.push({ id: `edit-expiry-${lot.id}`, message: expiryError });
    }
    return next;
  }

  function onBlurEditField() {
    setEditErrors(collectEditErrors(editName, editLots));
  }

  async function saveEdit(view: LocationView) {
    const next = collectEditErrors(editName, editLots);
    setEditErrors(next);
    if (next.length) return;

    setFormError("");
    try {
      const trimmed = editName.trim();
      if (trimmed !== view.item.name) {
        await patchItem.mutateAsync({ itemId: view.item.id, body: { name: trimmed } });
      }
      for (const draft of editLots) {
        const original = view.lots.find((lot) => lot.id === draft.id);
        if (!original) continue;
        const quantityValue = Number(draft.quantity);
        const expiryIso = draft.expiry.trim() ? dmyToIso(draft.expiry) : null;
        const body: Record<string, unknown> = {};
        if (quantityValue !== original.quantity) body.quantity = quantityValue;
        if (expiryIso !== original.expiryDate) body.expiryDate = expiryIso;
        if (Object.keys(body).length === 0) continue;
        await patchLot.mutateAsync({ lotId: draft.id, body });
      }
      setMessage("Item updated.");
      cancelEdit();
      await refresh();
    } catch {
      // formError set by mutation onError
    }
  }

  return (
    <div className="space-y-6" aria-busy={items.isLoading}>
      <div>
        <h1 className="font-heading text-2xl font-bold">Fridge</h1>
        <p className="text-sm text-muted-foreground">Stock by location. Use takes the soonest-expiring lot first.</p>
      </div>
      <div role="group" aria-label="Storage location" className="flex flex-wrap gap-2">
        {locations.map((entry) => (
          <FilterChip
            key={entry.id}
            pressed={location === entry.id}
            className="px-4"
            onClick={() => {
              setLocation(entry.id);
              cancelEdit();
            }}
          >
            {entry.label}
          </FilterChip>
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
          <Field id="item-category" label="Category">
            <CategorySelect value={category} onChange={setCategory} />
          </Field>
          <Field id="item-quantity" label="Quantity">
            <Input inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </Field>
          <Field id="item-unit" label="Unit">
            <Select
              value={unit}
              onChange={setUnit}
              options={units.map((option) => ({ value: option, label: option }))}
            />
          </Field>
          <Field id="item-expiry" label="Expiry">
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder="dd/mm/yyyy"
              maxLength={10}
              value={expiry}
              onChange={(event) => setExpiry(maskDmy(event.target.value))}
            />
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

      {!items.isLoading ? (
        <p className="text-sm text-muted-foreground">
          {locationViews.length} in the {location}
          {attentionCount > 0
            ? ` · ${attentionCount} need${attentionCount === 1 ? "s" : ""} attention`
            : ""}
        </p>
      ) : null}

      {!emptyLocation ? (
        <div className="space-y-3">
          <Field id="fridge-search" label="Search items">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name"
              autoComplete="off"
            />
          </Field>
          <div role="group" aria-label="Freshness" className="flex flex-wrap gap-2">
            {freshnessFilters.map((entry) => (
              <FilterChip
                key={entry.id}
                pressed={freshnessFilter === entry.id}
                className="px-3"
                onClick={() => setFreshnessFilter(entry.id)}
              >
                {entry.label}
              </FilterChip>
            ))}
          </div>
        </div>
      ) : null}

      {emptyLocation ? (
        <p className="text-sm text-muted-foreground">Nothing in this location yet. Add an item above.</p>
      ) : null}

      {emptyMatches ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {search.trim()
              ? `No items match “${search.trim()}”.`
              : `Nothing ${freshnessFilterLabel} in the ${location}.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {search.trim() ? (
              <Button type="button" variant="ghost" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : null}
            {freshnessFilter !== "all" ? (
              <Button type="button" variant="ghost" onClick={() => setFreshnessFilter("all")}>
                Show all freshness
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.id} className="space-y-3">
            <h2 className="font-heading text-lg font-bold">{group.title}</h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {group.items.map((view) => (
                <li key={view.item.id}>
                  <FridgeItemCard
                    view={view}
                    today={today}
                    editing={editingId === view.item.id}
                    editName={editName}
                    editLots={editLots}
                    editErrors={editErrors}
                    categoryPending={patchItem.isPending}
                    savePending={patchItem.isPending || patchLot.isPending}
                    usePending={useOne.isPending}
                    onEditNameChange={setEditName}
                    onBlurEditField={onBlurEditField}
                    onLotField={setLotField}
                    onCategoryChange={(next) =>
                      patchItem.mutate({ itemId: view.item.id, body: { category: next } })
                    }
                    onSave={() => void saveEdit(view)}
                    onCancel={cancelEdit}
                    onStartEdit={() => startEdit(view)}
                    onUse={() => useOne.mutate(view.item.id)}
                    onPin={() => pin.mutate(view.item)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {out.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-heading font-bold">Out of stock</h2>
          <ul className="flex flex-wrap gap-2">
            {out.map((item) => (
              <li
                key={item.id}
                className="rounded-full border border-border bg-muted px-3 py-1 text-sm text-muted-foreground"
              >
                {item.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
