const ALIASES: Record<string, string> = {
  scallion: "green onion",
  scallions: "green onion",
  "spring onion": "green onion",
  "spring onions": "green onion",
  "green onions": "green onion",
  "green onion": "green onion",
  "coconut milk": "coconut milk",
  "soy sauce": "soy sauce",
  "curry powder": "curry powder",
  "black bean": "black bean",
  cilantro: "coriander",
  coriander: "coriander",
  yoghurt: "yogurt",
  yogurt: "yogurt",
  yogurts: "yogurt",
  chilli: "chili",
  chile: "chili",
  chiles: "chili",
  chillies: "chili",
  chili: "chili",
  capsicum: "bell pepper",
  "bell peppers": "bell pepper",
  "bell pepper": "bell pepper",
  aubergine: "eggplant",
  eggplant: "eggplant",
  eggplants: "eggplant",
  eggs: "egg",
  egg: "egg",
  milks: "milk",
  milk: "milk",
  tomatoes: "tomato",
  tomato: "tomato",
  onions: "onion",
  onion: "onion",
  carrots: "carrot",
  carrot: "carrot",
  bananas: "banana",
  banana: "banana",
  berries: "berry",
  berry: "berry",
  oats: "oat",
  oat: "oat",
  noodles: "noodle",
  noodle: "noodle",
  tortillas: "tortilla",
  tortilla: "tortilla",
  "chicken breast": "chicken",
  "chicken thigh": "chicken",
  chicken: "chicken",
  "ground beef": "beef",
  mince: "beef",
  beef: "beef",
  "black beans": "black bean",
  chickpeas: "chickpea",
  chickpea: "chickpea",
  lentils: "lentil",
  lentil: "lentil",
  mushrooms: "mushroom",
  mushroom: "mushroom",
};

const MATCHERS = Object.entries(ALIASES).sort((a, b) => b[0].length - a[0].length);

export function canonicalName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (ALIASES[cleaned]) return ALIASES[cleaned];
  for (const [key, value] of MATCHERS) {
    const pattern = new RegExp(`\\b${key.replace(/\s+/g, "\\s+")}\\b`);
    if (pattern.test(cleaned)) return value;
  }
  return cleaned;
}
