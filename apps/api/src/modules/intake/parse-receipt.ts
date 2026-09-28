import type { ParsedLine } from "@smart-pantry/contracts";

const NOISE = new Set([
  "grand",
  "total",
  "subtotal",
  "sub",
  "tax",
  "hst",
  "gst",
  "pst",
  "vat",
  "change",
  "due",
  "cash",
  "visa",
  "mastercard",
  "amex",
  "american",
  "express",
  "debit",
  "credit",
  "balance",
  "amount",
  "cashier",
  "thank",
  "you",
  "thanks",
  "welcome",
  "receipt",
  "tel",
  "phone",
  "auth",
  "authorization",
  "approved",
  "saved",
  "discount",
  "coupon",
  "member",
  "savings",
  "points",
  "tender",
  "payment",
  "for",
  "shopping",
  "store",
  "transaction",
  "invoice",
  "date",
]);

function isNoise(name: string): boolean {
  const words = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.length === 0 || words.every((word) => NOISE.has(word));
}

function inferUnit(name: string): string {
  if (/\b(lb|lbs|pound|pounds)\b/i.test(name)) return "lb";
  if (/\b(oz|ounce|ounces)\b/i.test(name)) return "oz";
  if (/\bkg\b/i.test(name)) return "kg";
  if (/\bml\b/i.test(name)) return "ml";
  return "each";
}

export function parseReceipt(text: string): ParsedLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed: ParsedLine[] = [];
  for (const line of lines) {
    const priceMatch = line.match(/(\d+\.\d{2})\s*$/);
    if (!priceMatch || priceMatch.index === undefined) continue;
    let name = line.slice(0, priceMatch.index).replace(/[.\s]+$/, "").trim();
    if (!/[a-zA-Z]/.test(name)) continue;
    let quantity = 1;
    const quantityMatch = name.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (quantityMatch) {
      quantity = Number(quantityMatch[1]);
      name = quantityMatch[2]!.trim();
    }
    name = name.replace(/\s{2,}/g, " ").trim();
    if (name.length < 2 || isNoise(name) || quantity <= 0 || quantity > 999) continue;
    parsed.push({
      name,
      quantity,
      unit: inferUnit(name),
      price: Number(priceMatch[1]),
    });
  }
  return parsed;
}
