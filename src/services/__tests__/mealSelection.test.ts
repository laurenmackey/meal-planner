import { describe, it, expect } from "vitest";
import { rankMeals } from "../mealSelection";
import { Meal, HouseholdSettings } from "../../types";

function makeMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test Meal",
    url: null,
    sourceName: null,
    description: null,
    notes: null,
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    mainProtein: "chicken",
    rating: 7,
    easinessScore: 6,
    healthScore: 7,
    servingSize: 4,
    isBasic: false,
    isArchived: false,
    ...overrides,
  };
}

const defaultSettings: HouseholdSettings = {
  lookbackWeeks: 3,
  ratingWeight: 1,
  easinessWeight: 1,
  healthWeight: 1,
  preferredProteins: [],
  defaultMealCount: 3,
  basicMealCount: 2,
};

describe("rankMeals", () => {
  it("calculates score from weighted sum of rating, easiness, and health", () => {
    const meal = makeMeal({ rating: 8, easinessScore: 6, healthScore: 4 });
    const settings = { ...defaultSettings, ratingWeight: 2, easinessWeight: 1, healthWeight: 0.5 };
    const result = rankMeals([meal], settings, new Set());
    // 8*2 + 6*1 + 4*0.5 + varietyBonus(2) = 16 + 6 + 2 + 2 = 26
    expect(result[0].score).toBe(26);
  });

  it("gives protein variety bonus for unused proteins", () => {
    const chicken = makeMeal({ id: 1, mainProtein: "chicken" });
    const beef = makeMeal({ id: 2, mainProtein: "beef" });
    const usedProteins = new Set<string | null>(["chicken"]);

    const result = rankMeals([chicken, beef], defaultSettings, usedProteins);
    // beef should rank higher (gets +2 variety bonus)
    expect(result[0].mainProtein).toBe("beef");
  });

  it("gives no variety bonus for already-used proteins", () => {
    const meal = makeMeal({ rating: 7, easinessScore: 6, healthScore: 7 });
    const usedProteins = new Set<string | null>(["chicken"]);
    const result = rankMeals([meal], defaultSettings, usedProteins);
    // 7+6+7+0(no variety) = 20
    expect(result[0].score).toBe(20);
  });

  it("gives preferred protein bonus", () => {
    const chicken = makeMeal({ id: 1, mainProtein: "chicken", rating: 5, easinessScore: 5, healthScore: 5 });
    const beef = makeMeal({ id: 2, mainProtein: "beef", rating: 5, easinessScore: 5, healthScore: 5 });
    const settings = { ...defaultSettings, preferredProteins: ["beef"] as any };

    const result = rankMeals([chicken, beef], settings, new Set());
    // Both get variety bonus since set is empty, but beef gets +1 preferred
    expect(result[0].mainProtein).toBe("beef");
  });

  it("sorts meals by score descending", () => {
    const low = makeMeal({ id: 1, rating: 3, easinessScore: 3, healthScore: 3 });
    const high = makeMeal({ id: 2, rating: 9, easinessScore: 9, healthScore: 9 });
    const mid = makeMeal({ id: 3, rating: 6, easinessScore: 6, healthScore: 6 });

    const result = rankMeals([low, high, mid], defaultSettings, new Set());
    expect(result[0].id).toBe(2);
    expect(result[1].id).toBe(3);
    expect(result[2].id).toBe(1);
  });

  it("handles null mainProtein without crashing", () => {
    const meal = makeMeal({ mainProtein: null });
    const result = rankMeals([meal], defaultSettings, new Set());
    expect(result).toHaveLength(1);
  });

  it("handles empty meals array", () => {
    const result = rankMeals([], defaultSettings, new Set());
    expect(result).toEqual([]);
  });
});
