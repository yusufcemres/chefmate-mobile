// ========== AUTH ==========
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'EDITOR' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserPreference {
  id: string;
  dietaryProfile: Record<string, any> | null;
  allergens: string[];
  dislikedItems: string[];
  servingSize: number;
}

// ========== PRODUCTS ==========
export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  category?: Category;
  aliases: string[];
  avgUnitWeightG: number | null;
  packageDefaults: Record<string, number>;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  seasonMonths: number[];
  substituteIds: string[];
}

// ========== INVENTORY ==========
export interface InventoryItem {
  id: string;
  userId: string;
  productId: string;
  product?: Product & { productName?: string };
  quantity?: number;
  quantityDisplay: number;
  displayUnit: string;
  quantityNormalized: number;
  normalizedUnit: string;
  storageLocation: string;
  expirationDate: string | null;
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'DELETED';
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  transactionType: 'ADD' | 'REMOVE' | 'ADJUST' | 'RECIPE_DEDUCT' | 'EXPIRE';
  quantityChange: number;
  unit: string;
  note: string | null;
  createdAt: string;
}

// ========== RECIPES ==========
export interface Recipe {
  id: string;
  title: string;
  slug?: string;
  description: string;
  difficulty: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  servingSize: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  imageUrl: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: Tag[];
}

export interface RecipeIngredient {
  id: string;
  productId: string;
  product?: Product;
  ingredientNameSnapshot: string;
  requiredQuantity: number;
  requiredUnit: string;
  role: 'main' | 'seasoning' | 'optional';
}

export interface RecipeStep {
  id: string;
  stepOrder: number;
  instruction: string;
  durationMinutes: number | null;
  tip: string | null;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  type?: 'CATEGORY' | 'CUISINE' | 'DIETARY' | 'ATTRIBUTE' | 'SEASONAL';
  emoji?: string;
}

export interface TagWithCount extends Tag {
  _count?: { recipes: number };
}

// ========== RECOMMENDATIONS ==========
export interface Recommendation {
  recipe: Recipe;
  recipeId: string;
  compatibilityScore: number;
  practicalityScore: number;
  finalScore: number;
  totalIngredients: number;
  matchedIngredients: number;
  missingMainCount: number;
  seasonBonus: number;
  missingIngredients: {
    ingredientId: string;
    productId: string;
    ingredientName: string;
    role: string;
    isOptional: boolean;
    requiredNormalized: number;
    availableNormalized: number;
    normalizedUnit: string;
    isSatisfied: boolean;
    coverageRatio: number;
  }[];
  availableIngredients: any[];
  substitutionHints: string[];
}

// ========== AI DETECTION ==========
export interface AiDetectionJob {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'DETECTED' | 'APPLIED' | 'FAILED';
  detectedItems: DetectedItem[];
  createdAt: string;
}

export interface DetectedItem {
  name: string;
  quantity: number;
  unit: string;
  confidence: number;
  matchedProductId: string | null;
  matchedProductName: string | null;
}

// ========== COOKING MODE ==========
export interface CookingMode {
  recipe: Recipe;
  totalSteps: number;
  totalDurationMinutes: number;
  steps: CookingStep[];
}

export interface CookingStep {
  stepOrder: number;
  instruction: string;
  durationMinutes: number | null;
  tip: string | null;
  ingredientsUsed: string[];
  progressPercent: number;
}

// ========== SHOPPING LISTS ==========
export interface ShoppingList {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  items: ShoppingListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  productId: string | null;
  customName: string | null;
  quantity: number;
  unit: string;
  isChecked: boolean;
  recipeId: string | null;
  sortOrder: number;
  createdAt: string;
}

// ========== HOUSEHOLDS ==========
export interface Household {
  id: string;
  name: string;
  ownerId: string;
  myRole: 'OWNER' | 'MEMBER';
  members: HouseholdMember[];
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
  user: { id: string; displayName: string; email: string };
  joinedAt: string;
}

// ========== MEAL PLANS ==========
export interface MealPlan {
  id: string;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  items: MealPlanItem[];
  byDate?: Record<string, MealPlanItem[]>;
  _count?: { items: number };
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanItem {
  id: string;
  mealPlanId: string;
  recipeId: string;
  date: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  servings: number;
  isCooked: boolean;
  sortOrder: number;
  recipe?: {
    id: string;
    title: string;
    slug: string;
    difficulty: string;
    totalTimeMinutes: number;
    servingSize: number;
    imageUrl: string | null;
    totalCalories: number | null;
  };
}

// ========== AI SUGGESTION ==========
export interface AiSuggestionResult {
  logId?: string;
  title: string;
  description: string;
  ingredients: AiSuggestedIngredient[];
  steps: string[];
  difficulty: string;
  servingSize: number;
  changesSummary: string[];
  nutritionEstimate?: { calories: string; protein: string };
  processingTimeMs?: number;
}

export interface AiSuggestedIngredient {
  name: string;
  quantity: number;
  unit: string;
  role: string;
  isChanged: boolean;
  changeNote?: string;
}

// ========== PAGINATION ==========
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
}
