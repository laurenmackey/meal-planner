export const PROTEINS = ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'shrimp', 'prawns', 'crab', 'tofu', 'none', 'other'] as const;
export type Protein = typeof PROTEINS[number];
export type SelectionStatus = 'proposed' | 'rejected' | 'accepted';

export interface Meal {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  url: string | null;
  sourceName: string | null;
  description: string | null;
  notes: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  mainProtein: Protein | null;
  rating: number;
  easinessScore: number;
  healthScore: number;
  servingSize: number;
}

export interface MealSelection extends Meal {
  foodSelectionId: number;
  selectionStatus: SelectionStatus;
  score: number;
}

export interface FoodSelection {
  id: number;
  chosenAt: Date;
  updatedAt: Date;
  status: SelectionStatus;
  mealId: number | null;
  foodStapleId: number | null;
}

export interface User {
  id: number;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Household {
  id: number;
  name: string;
  inviteCode: string;
}

export interface AuthResponse {
  user: { id: number; email: string };
  household: Household;
}

export interface MeResponse {
  user: { userId: number; email: string };
  household: Household;
}

export interface ChooseWeeklyMealsResponse {
  meals: MealSelection[];
}

export interface RejectFoodSelectionsResponse {
  updated: FoodSelection[];
}

export const MEASUREMENT_UNITS = ['cups', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'ml', 'l', 'whole', 'cloves', 'pinch', 'to_taste'] as const;
export type MeasurementUnit = typeof MEASUREMENT_UNITS[number];

export interface ParsedIngredient {
  name: string;
  quantity: number;
  measurementUnit: MeasurementUnit;
  optional: boolean;
  notes: string | null;
}

export interface ParsedRecipe {
  name: string;
  url: string;
  sourceName: string | null;
  description: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  mainProtein: Protein | null;
  servingSize: number;
  ingredients: ParsedIngredient[];
}
