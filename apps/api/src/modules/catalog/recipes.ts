import type { MealType, NutritionFacts } from "@smart-pantry/contracts";

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  mealType: MealType;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  nutrition: NutritionFacts;
}

function recipe(
  id: string,
  name: string,
  mealType: MealType,
  ingredients: RecipeIngredient[],
  steps: string[],
  nutrition: NutritionFacts,
): Recipe {
  return { id, name, mealType, servings: 2, ingredients, steps, nutrition };
}

export const RECIPES: Recipe[] = [
  recipe(
    "veggie-omelette",
    "Veggie omelette",
    "breakfast",
    [
      { name: "egg", quantity: 3, unit: "each" },
      { name: "spinach", quantity: 1, unit: "cup" },
      { name: "bell pepper", quantity: 1, unit: "each" },
      { name: "milk", quantity: 2, unit: "tbsp" },
    ],
    ["Whisk the eggs with the milk.", "Cook the pepper and spinach.", "Fold the eggs over the vegetables."],
    { calories: 280, protein: 19, carbs: 8, fat: 18, fiber: 2, sodium: 240 },
  ),
  recipe(
    "yogurt-parfait",
    "Yogurt parfait",
    "breakfast",
    [
      { name: "yogurt", quantity: 1, unit: "cup" },
      { name: "berry", quantity: 1, unit: "cup" },
      { name: "oat", quantity: 0.25, unit: "cup" },
    ],
    ["Spoon yogurt into a bowl.", "Top with berries and oats.", "Serve cold."],
    { calories: 260, protein: 14, carbs: 38, fat: 6, fiber: 5, sodium: 90 },
  ),
  recipe(
    "overnight-oats",
    "Overnight oats",
    "breakfast",
    [
      { name: "oat", quantity: 0.5, unit: "cup" },
      { name: "milk", quantity: 0.5, unit: "cup" },
      { name: "banana", quantity: 1, unit: "each" },
    ],
    ["Stir oats into the milk.", "Chill overnight.", "Top with sliced banana."],
    { calories: 310, protein: 12, carbs: 52, fat: 6, fiber: 7, sodium: 80 },
  ),
  recipe(
    "avocado-toast",
    "Avocado toast",
    "breakfast",
    [
      { name: "bread", quantity: 2, unit: "slice" },
      { name: "avocado", quantity: 1, unit: "each" },
      { name: "egg", quantity: 1, unit: "each" },
    ],
    ["Toast the bread.", "Mash the avocado on top.", "Add a fried egg."],
    { calories: 390, protein: 14, carbs: 32, fat: 24, fiber: 8, sodium: 280 },
  ),
  recipe(
    "banana-pancakes",
    "Banana pancakes",
    "breakfast",
    [
      { name: "banana", quantity: 1, unit: "each" },
      { name: "egg", quantity: 2, unit: "each" },
      { name: "oat", quantity: 0.25, unit: "cup" },
    ],
    ["Mash the banana with the eggs and oats.", "Cook small rounds in a pan.", "Serve warm."],
    { calories: 300, protein: 14, carbs: 36, fat: 11, fiber: 4, sodium: 140 },
  ),
  recipe(
    "spinach-scramble",
    "Spinach scramble",
    "breakfast",
    [
      { name: "egg", quantity: 2, unit: "each" },
      { name: "spinach", quantity: 1, unit: "cup" },
      { name: "green onion", quantity: 1, unit: "each" },
    ],
    ["Wilt the spinach and green onion.", "Scramble in the eggs.", "Season and serve."],
    { calories: 220, protein: 16, carbs: 6, fat: 14, fiber: 2, sodium: 180 },
  ),
  recipe(
    "berry-smoothie",
    "Berry smoothie",
    "breakfast",
    [
      { name: "berry", quantity: 1, unit: "cup" },
      { name: "yogurt", quantity: 0.5, unit: "cup" },
      { name: "milk", quantity: 0.5, unit: "cup" },
    ],
    ["Add the fruit, yogurt, and milk to a blender.", "Blend until smooth.", "Pour and drink cold."],
    { calories: 210, protein: 11, carbs: 32, fat: 4, fiber: 4, sodium: 95 },
  ),
  recipe(
    "breakfast-burrito",
    "Breakfast burrito",
    "breakfast",
    [
      { name: "egg", quantity: 2, unit: "each" },
      { name: "tortilla", quantity: 1, unit: "each" },
      { name: "cheese", quantity: 0.25, unit: "cup" },
      { name: "bell pepper", quantity: 0.5, unit: "each" },
    ],
    ["Scramble the eggs with the pepper.", "Sprinkle on the cheese.", "Roll it in the tortilla."],
    { calories: 420, protein: 22, carbs: 30, fat: 22, fiber: 3, sodium: 520 },
  ),
  recipe(
    "tomato-basil-pasta",
    "Tomato basil pasta",
    "lunch",
    [
      { name: "pasta", quantity: 200, unit: "g" },
      { name: "tomato", quantity: 2, unit: "each" },
      { name: "basil", quantity: 0.25, unit: "cup" },
      { name: "garlic", quantity: 2, unit: "clove" },
    ],
    ["Boil the pasta.", "Simmer tomato and garlic.", "Toss with basil."],
    { calories: 430, protein: 14, carbs: 78, fat: 6, fiber: 6, sodium: 40 },
  ),
  recipe(
    "tuna-sandwich",
    "Tuna sandwich",
    "lunch",
    [
      { name: "tuna", quantity: 1, unit: "can" },
      { name: "bread", quantity: 2, unit: "slice" },
      { name: "yogurt", quantity: 2, unit: "tbsp" },
      { name: "green onion", quantity: 1, unit: "each" },
    ],
    ["Stir the tuna with yogurt and green onion.", "Spoon onto bread.", "Close and slice."],
    { calories: 360, protein: 28, carbs: 32, fat: 10, fiber: 3, sodium: 540 },
  ),
  recipe(
    "vegetable-fried-rice",
    "Vegetable fried rice",
    "lunch",
    [
      { name: "rice", quantity: 2, unit: "cup" },
      { name: "egg", quantity: 1, unit: "each" },
      { name: "green onion", quantity: 2, unit: "each" },
      { name: "carrot", quantity: 1, unit: "each" },
      { name: "soy sauce", quantity: 1, unit: "tbsp" },
    ],
    ["Scramble the egg and set it aside.", "Stir-fry the carrot and rice.", "Fold in the egg, green onion, and soy sauce."],
    { calories: 410, protein: 12, carbs: 72, fat: 8, fiber: 4, sodium: 620 },
  ),
  recipe(
    "lentil-soup",
    "Lentil soup",
    "lunch",
    [
      { name: "lentil", quantity: 1, unit: "cup" },
      { name: "carrot", quantity: 1, unit: "each" },
      { name: "onion", quantity: 1, unit: "each" },
      { name: "garlic", quantity: 2, unit: "clove" },
    ],
    ["Soften the onion, carrot, and garlic.", "Add lentils and water.", "Simmer until the lentils are tender."],
    { calories: 280, protein: 18, carbs: 46, fat: 2, fiber: 12, sodium: 30 },
  ),
  recipe(
    "caprese-sandwich",
    "Caprese sandwich",
    "lunch",
    [
      { name: "bread", quantity: 2, unit: "slice" },
      { name: "tomato", quantity: 1, unit: "each" },
      { name: "mozzarella", quantity: 60, unit: "g" },
      { name: "basil", quantity: 4, unit: "leaf" },
    ],
    ["Layer tomato, mozzarella, and basil on bread.", "Close the sandwich.", "Serve at room temperature."],
    { calories: 380, protein: 18, carbs: 34, fat: 18, fiber: 3, sodium: 460 },
  ),
  recipe(
    "chickpea-salad",
    "Chickpea salad",
    "lunch",
    [
      { name: "chickpea", quantity: 1, unit: "cup" },
      { name: "cucumber", quantity: 0.5, unit: "each" },
      { name: "tomato", quantity: 1, unit: "each" },
      { name: "lemon", quantity: 0.5, unit: "each" },
    ],
    ["Chop the cucumber and tomato.", "Toss with chickpeas.", "Dress with lemon."],
    { calories: 290, protein: 13, carbs: 46, fat: 6, fiber: 11, sodium: 40 },
  ),
  recipe(
    "egg-salad-wrap",
    "Egg salad wrap",
    "lunch",
    [
      { name: "egg", quantity: 2, unit: "each" },
      { name: "tortilla", quantity: 1, unit: "each" },
      { name: "yogurt", quantity: 1, unit: "tbsp" },
      { name: "green onion", quantity: 1, unit: "each" },
    ],
    ["Chop the eggs with yogurt and green onion.", "Spoon onto the tortilla.", "Roll and slice."],
    { calories: 340, protein: 18, carbs: 26, fat: 16, fiber: 2, sodium: 380 },
  ),
  recipe(
    "chicken-rice-bowl",
    "Chicken rice bowl",
    "lunch",
    [
      { name: "chicken", quantity: 150, unit: "g" },
      { name: "rice", quantity: 1, unit: "cup" },
      { name: "broccoli", quantity: 1, unit: "cup" },
      { name: "soy sauce", quantity: 1, unit: "tbsp" },
    ],
    ["Cook the rice.", "Sear the chicken and steam the broccoli.", "Slice the chicken over the rice and season."],
    { calories: 480, protein: 36, carbs: 52, fat: 10, fiber: 4, sodium: 640 },
  ),
  recipe(
    "garlic-salmon",
    "Garlic butter salmon",
    "dinner",
    [
      { name: "salmon", quantity: 200, unit: "g" },
      { name: "garlic", quantity: 2, unit: "clove" },
      { name: "lemon", quantity: 0.5, unit: "each" },
      { name: "butter", quantity: 1, unit: "tbsp" },
    ],
    ["Sear the salmon in butter.", "Add garlic and lemon.", "Finish until the fish flakes."],
    { calories: 460, protein: 34, carbs: 3, fat: 34, fiber: 0, sodium: 180 },
  ),
  recipe(
    "beef-stir-fry",
    "Beef stir fry",
    "dinner",
    [
      { name: "beef", quantity: 200, unit: "g" },
      { name: "bell pepper", quantity: 1, unit: "each" },
      { name: "broccoli", quantity: 1, unit: "cup" },
      { name: "soy sauce", quantity: 1, unit: "tbsp" },
      { name: "green onion", quantity: 2, unit: "each" },
    ],
    ["Sear the beef.", "Add the pepper and broccoli.", "Toss with soy sauce and green onion."],
    { calories: 420, protein: 34, carbs: 16, fat: 22, fiber: 4, sodium: 680 },
  ),
  recipe(
    "vegetable-curry",
    "Vegetable curry",
    "dinner",
    [
      { name: "chickpea", quantity: 1, unit: "cup" },
      { name: "coconut milk", quantity: 0.5, unit: "cup" },
      { name: "onion", quantity: 1, unit: "each" },
      { name: "spinach", quantity: 2, unit: "cup" },
      { name: "curry powder", quantity: 1, unit: "tbsp" },
    ],
    ["Soften the onion with curry powder.", "Simmer chickpeas in coconut milk.", "Wilt in the spinach."],
    { calories: 440, protein: 15, carbs: 42, fat: 24, fiber: 10, sodium: 90 },
  ),
  recipe(
    "chicken-fajitas",
    "Chicken fajitas",
    "dinner",
    [
      { name: "chicken", quantity: 200, unit: "g" },
      { name: "bell pepper", quantity: 1, unit: "each" },
      { name: "onion", quantity: 1, unit: "each" },
      { name: "tortilla", quantity: 2, unit: "each" },
    ],
    ["Slice the chicken, pepper, and onion.", "Sear until browned.", "Serve in tortillas."],
    { calories: 470, protein: 38, carbs: 36, fat: 16, fiber: 4, sodium: 420 },
  ),
  recipe(
    "mushroom-risotto",
    "Mushroom risotto",
    "dinner",
    [
      { name: "rice", quantity: 0.75, unit: "cup" },
      { name: "mushroom", quantity: 200, unit: "g" },
      { name: "onion", quantity: 1, unit: "each" },
      { name: "parmesan", quantity: 30, unit: "g" },
    ],
    ["Soften the onion and mushroom.", "Stir the rice with hot broth until creamy.", "Finish with parmesan."],
    { calories: 450, protein: 14, carbs: 70, fat: 10, fiber: 3, sodium: 320 },
  ),
  recipe(
    "lemon-herb-chicken",
    "Lemon herb chicken",
    "dinner",
    [
      { name: "chicken", quantity: 200, unit: "g" },
      { name: "lemon", quantity: 1, unit: "each" },
      { name: "garlic", quantity: 2, unit: "clove" },
      { name: "broccoli", quantity: 2, unit: "cup" },
    ],
    ["Season the chicken with lemon and garlic.", "Roast beside the broccoli.", "Rest a few minutes, then serve."],
    { calories: 390, protein: 42, carbs: 14, fat: 16, fiber: 5, sodium: 160 },
  ),
  recipe(
    "black-bean-tacos",
    "Black bean tacos",
    "dinner",
    [
      { name: "black bean", quantity: 1, unit: "cup" },
      { name: "tortilla", quantity: 2, unit: "each" },
      { name: "salsa", quantity: 0.25, unit: "cup" },
      { name: "cheese", quantity: 0.25, unit: "cup" },
    ],
    ["Warm the beans with salsa.", "Fill the tortillas.", "Top with cheese."],
    { calories: 430, protein: 20, carbs: 58, fat: 14, fiber: 14, sodium: 480 },
  ),
  recipe(
    "scallion-noodles",
    "Scallion noodles",
    "dinner",
    [
      { name: "noodle", quantity: 200, unit: "g" },
      { name: "green onion", quantity: 3, unit: "each" },
      { name: "soy sauce", quantity: 1, unit: "tbsp" },
      { name: "egg", quantity: 1, unit: "each" },
      { name: "garlic", quantity: 1, unit: "clove" },
    ],
    ["Boil the noodles.", "Fry the egg with garlic and green onion.", "Toss everything with soy sauce."],
    { calories: 470, protein: 18, carbs: 68, fat: 12, fiber: 4, sodium: 700 },
  ),
];
