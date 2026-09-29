export type LocationName = "refrigerator" | "freezer" | "pantry";
export type Role = "owner" | "member";
export type MealType = "breakfast" | "lunch" | "dinner";
export type Freshness = "fresh" | "expiring" | "expired" | "unknown";
export type ShoppingReason = "below-par" | "favorite-running-low" | "missing-ingredient";
export type AdviceSource = "model" | "matcher";

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  role: Role;
  inviteCode: string;
}

export interface CreateHouseholdRequest {
  name: string;
}

export interface JoinHouseholdRequest {
  inviteCode: string;
}

export interface StockLot {
  id: string;
  location: LocationName;
  quantity: number;
  expiryDate: string | null;
}

export interface PantryItem {
  id: string;
  name: string;
  unit: string;
  parLevel: number | null;
  pinned: boolean;
  lots: StockLot[];
  onHand: number;
  freshness: Freshness;
  nextExpiry: string | null;
}

export interface CreateItemRequest {
  name: string;
  unit: string;
  quantity: number;
  location: LocationName;
  expiryDate: string | null;
  parLevel: number | null;
}

export interface UpdateItemRequest {
  name?: string;
  unit?: string;
  parLevel?: number | null;
  pinned?: boolean;
}

export interface AddLotRequest {
  quantity: number;
  location: LocationName;
  expiryDate: string | null;
}

export interface UpdateLotRequest {
  quantity?: number;
  location?: LocationName;
  expiryDate?: string | null;
}

export interface UseItemRequest {
  quantity: number;
}

export interface ParsedLine {
  name: string;
  quantity: number;
  unit: string;
  price: number | null;
}

export interface ParseReceiptRequest {
  text: string;
}

export interface ParseReceiptResponse {
  lines: ParsedLine[];
}

export interface CommitLine {
  name: string;
  quantity: number;
  unit: string;
  expiryDate: string | null;
}

export interface CommitIntakeRequest {
  location: LocationName;
  lines: CommitLine[];
}

export interface NutritionFacts {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
}

export interface MealSuggestion {
  recipeId: string;
  name: string;
  mealType: MealType;
  matchPercent: number;
  onHand: string[];
  missing: string[];
  steps: string[];
  nutrition: NutritionFacts;
  advice: string;
  nearMatch: boolean;
}

export interface MealsResponse {
  source: AdviceSource;
  meals: MealSuggestion[];
}

export interface ShoppingNeed {
  key: string;
  name: string;
  reason: ShoppingReason;
  detail: string;
  suggestedQuantity: number;
  unit: string;
}

export interface ShoppingResponse {
  source: AdviceSource;
  needs: ShoppingNeed[];
}

export interface DismissShoppingRequest {
  key: string;
}

export interface Favorite {
  itemId: string;
  name: string;
  useCount: number;
  pinned: boolean;
}

export interface FavoritesResponse {
  favorites: Favorite[];
}

export interface HomeResponse {
  householdName: string;
  refrigerator: PantryItem[];
  expiringSoon: PantryItem[];
  meals: MealSuggestion[];
  shoppingCount: number;
  favorites: Favorite[];
  source: AdviceSource;
}

export interface CatalogRecipeSummary {
  id: string;
  name: string;
  mealType: MealType;
  nutrition: NutritionFacts;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export type CodexConnectStatus = "starting" | "awaiting" | "connected" | "failed";

export interface CodexLoginStatus {
  connected: boolean;
  configured: boolean;
  connectedAt: string | null;
}

export interface CodexConnectSession {
  sessionId: string;
  status: CodexConnectStatus;
  verificationUrl: string | null;
  userCode: string | null;
  error: string | null;
}
