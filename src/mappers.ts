import { Meal, FoodSelection } from "./types";

export function toMeal(row: any): Meal {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    url: row.url,
    sourceName: row.source_name,
    description: row.description,
    notes: row.notes,
    prepTimeMinutes: row.prep_time_minutes,
    cookTimeMinutes: row.cook_time_minutes,
    mainProtein: row.main_protein,
    rating: row.rating,
    easinessScore: row.easiness_score,
    healthScore: row.health_score,
    servingSize: row.serving_size,
    isBasic: row.is_basic,
  };
}

export function toFoodSelection(row: any): FoodSelection {
  return {
    id: row.id,
    chosenAt: row.chosen_at,
    updatedAt: row.updated_at,
    status: row.status,
    mealId: row.meal_id,
    foodStapleId: row.food_staple_id,
  };
}
