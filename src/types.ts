export type Protein = 'chicken' | 'beef' | 'pork' | 'turkey' | 'fish' | 'shrimp' | 'prawns' | 'crab' | 'tofu' | 'none' | 'other';
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

export interface ChooseWeeklyMealsResponse {
  meals: MealSelection[];
}

export interface RejectFoodItemsResponse {
  updated: FoodSelection[];
}
