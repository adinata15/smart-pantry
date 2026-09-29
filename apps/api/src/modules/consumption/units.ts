const UNIT_ALIASES: Record<string, string> = {
  each: "each",
  ea: "each",
  piece: "each",
  pieces: "each",
  unit: "each",
  units: "each",
  slice: "slice",
  slices: "slice",
  cup: "cup",
  cups: "cup",
  tbsp: "tablespoon",
  tablespoon: "tablespoon",
  tablespoons: "tablespoon",
  tsp: "teaspoon",
  teaspoon: "teaspoon",
  teaspoons: "teaspoon",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  pound: "lb",
  pounds: "lb",
};

export function normalizeUnit(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

export function unitsMatch(a: string, b: string): boolean {
  const left = normalizeUnit(a);
  const right = normalizeUnit(b);
  return Boolean(left) && left === right;
}
