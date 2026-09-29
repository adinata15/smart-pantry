import type { LocationName, ParsedLine } from "@smart-pantry/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlSurfaceClassName, Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { api, withToday } from "@/lib/api";
import { cn } from "@/lib/cn";
import { createTesseractEngine } from "@/ocr/tesseract-engine";
import { SAMPLE_RECEIPT } from "@/sample-receipt";
import { useSession } from "@/shell/session";

const engine = createTesseractEngine();

const locationOptions: SelectOption[] = [
  { value: "refrigerator", label: "Refrigerator" },
  { value: "freezer", label: "Freezer" },
  { value: "pantry", label: "Pantry" },
];

export function ScanPage() {
  const { household } = useSession();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [lines, setLines] = useState<ParsedLine[] | null>(null);
  const [location, setLocation] = useState<LocationName>("refrigerator");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const parse = useMutation({
    mutationFn: () => api<{ lines: ParsedLine[] }>("/v1/intake/parse", { method: "POST", body: JSON.stringify({ text }) }),
    onSuccess: (result) => {
      setLines(result.lines);
      setError("");
      setStatus(result.lines.length ? "Review the lines, then commit them as stock." : "No item lines were found.");
    },
    onError: () => setError("Could not parse that receipt."),
  });

  const commit = useMutation({
    mutationFn: () =>
      api(withToday(`/v1/households/${household!.id}/intake/commit`), {
        method: "POST",
        body: JSON.stringify({
          location,
          lines: (lines ?? []).map((line) => ({
            name: line.name,
            quantity: line.quantity,
            unit: line.unit,
            expiryDate: null,
          })),
        }),
      }),
    onSuccess: async () => {
      setStatus("Stock committed. The photo was not stored.");
      setLines(null);
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["items", household?.id] });
      await queryClient.invalidateQueries({ queryKey: ["home", household?.id] });
      await queryClient.invalidateQueries({ queryKey: ["shopping", household?.id] });
    },
    onError: () => setError("Could not commit that stock."),
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setStatus("Reading the receipt on this device…");
    try {
      const recognized = await engine.recognize(file);
      setText(recognized);
      setStatus("Recognized text is ready. Only this text is sent when you parse.");
    } catch {
      setError("Could not read that image. Paste the receipt text instead.");
      setStatus("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Scan</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The photo stays on this device. Parsing sends the recognized text, not the image.
        </p>
      </div>
      <Card className="space-y-4">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-2xl border border-transparent bg-accent px-4 text-sm font-semibold text-on-accent shadow-glass-soft transition-colors duration-200 hover:bg-accent-hover">
          Upload a photo
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </label>
        <div className="space-y-1">
          <label htmlFor="receipt-text" className="text-sm font-semibold">
            Recognized text
          </label>
          <textarea
            id="receipt-text"
            className={cn("min-h-40 w-full p-3", controlSurfaceClassName)}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => setText(SAMPLE_RECEIPT)}>
            Use sample receipt
          </Button>
          <Button type="button" onClick={() => parse.mutate()} disabled={parse.isPending || !text.trim()}>
            Parse receipt
          </Button>
        </div>
      </Card>
      {status ? (
        <p role="status" className="text-sm">
          {status}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
      {lines && lines.length > 0 ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-heading text-lg font-bold">Review</h2>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <label htmlFor="scan-location">Location</label>
              <Select
                id="scan-location"
                className="min-w-[10rem]"
                value={location}
                onChange={(next) => setLocation(next as LocationName)}
                options={locationOptions}
              />
            </div>
          </div>
          <ul className="space-y-3">
            {lines.map((line, index) => (
              <li key={`${line.name}-${index}`} className="grid gap-2 md:grid-cols-[1fr_8rem_6rem_8rem_auto]">
                <Input
                  aria-label={`Item ${index + 1}`}
                  value={line.name}
                  onChange={(event) =>
                    setLines(lines.map((entry, entryIndex) => (entryIndex === index ? { ...entry, name: event.target.value } : entry)))
                  }
                />
                <Input
                  aria-label={`Quantity ${index + 1}`}
                  inputMode="decimal"
                  value={String(line.quantity)}
                  onChange={(event) =>
                    setLines(
                      lines.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, quantity: Number(event.target.value) } : entry,
                      ),
                    )
                  }
                />
                <p className="self-center text-sm font-semibold">{line.unit}</p>
                <p className="self-center text-sm text-muted-foreground">{line.price != null ? `$${line.price.toFixed(2)}` : ""}</p>
                <Button type="button" variant="ghost" onClick={() => setLines(lines.filter((_, entryIndex) => entryIndex !== index))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" onClick={() => commit.mutate()} disabled={commit.isPending}>
            Commit stock
          </Button>
        </Card>
      ) : null}
      {status.includes("committed") ? (
        <Link to="/fridge" className="inline-flex min-h-11 items-center font-semibold underline">
          See it in the fridge
        </Link>
      ) : null}
    </div>
  );
}
