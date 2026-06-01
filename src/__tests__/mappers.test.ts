import { describe, it, expect } from "vitest";
import { toMeal, toFoodSelection } from "../mappers";

describe("toMeal", () => {
  it("maps snake_case DB row to camelCase Meal", () => {
    const row = {
      id: 1,
      created_at: new Date("2024-01-01"),
      updated_at: new Date("2024-01-02"),
      name: "Chicken Stir Fry",
      url: "https://example.com",
      source_name: "NYT",
      description: "A quick stir fry",
      notes: "Use fresh ginger",
      prep_time_minutes: 15,
      cook_time_minutes: 20,
      main_protein: "chicken",
      rating: 8,
      easiness_score: 7,
      health_score: 9,
      serving_size: 4,
      is_basic: false,
      is_archived: false,
    };

    const meal = toMeal(row);

    expect(meal.id).toBe(1);
    expect(meal.createdAt).toEqual(new Date("2024-01-01"));
    expect(meal.updatedAt).toEqual(new Date("2024-01-02"));
    expect(meal.name).toBe("Chicken Stir Fry");
    expect(meal.url).toBe("https://example.com");
    expect(meal.sourceName).toBe("NYT");
    expect(meal.description).toBe("A quick stir fry");
    expect(meal.notes).toBe("Use fresh ginger");
    expect(meal.prepTimeMinutes).toBe(15);
    expect(meal.cookTimeMinutes).toBe(20);
    expect(meal.mainProtein).toBe("chicken");
    expect(meal.rating).toBe(8);
    expect(meal.easinessScore).toBe(7);
    expect(meal.healthScore).toBe(9);
    expect(meal.servingSize).toBe(4);
    expect(meal.isBasic).toBe(false);
    expect(meal.isArchived).toBe(false);
  });

  it("handles null optional fields", () => {
    const row = {
      id: 2,
      created_at: new Date(),
      updated_at: new Date(),
      name: "Simple Pasta",
      url: null,
      source_name: null,
      description: null,
      notes: null,
      prep_time_minutes: null,
      cook_time_minutes: null,
      main_protein: "none",
      rating: 5,
      easiness_score: 9,
      health_score: 4,
      serving_size: 2,
      is_basic: true,
      is_archived: false,
    };

    const meal = toMeal(row);
    expect(meal.url).toBeNull();
    expect(meal.description).toBeNull();
    expect(meal.prepTimeMinutes).toBeNull();
    expect(meal.isBasic).toBe(true);
  });
});

describe("toFoodSelection", () => {
  it("maps snake_case DB row to camelCase FoodSelection", () => {
    const row = {
      id: 10,
      created_at: new Date("2024-06-01"),
      chosen_for_week: "2024-06-01",
      updated_at: new Date("2024-06-02"),
      status: "proposed",
      meal_id: 5,
      food_staple_id: null,
    };

    const fs = toFoodSelection(row);
    expect(fs.id).toBe(10);
    expect(fs.createdAt).toEqual(new Date("2024-06-01"));
    expect(fs.chosenForWeek).toBe("2024-06-01");
    expect(fs.updatedAt).toEqual(new Date("2024-06-02"));
    expect(fs.status).toBe("proposed");
    expect(fs.mealId).toBe(5);
    expect(fs.foodStapleId).toBeNull();
  });
});
