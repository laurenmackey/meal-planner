import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { cleanDatabase, closeDatabase, createTestUser, createTestMeal, createTestIngredients } from "../../test/setup";
import pool from "../../db";

describe("Food selections routes", () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe("POST /api/v1/chooseWeeklyMeals", () => {
    it("generates meals and returns them", async () => {
      await createTestMeal(user.householdId, { name: "Meal A", main_protein: "chicken" });
      await createTestMeal(user.householdId, { name: "Meal B", main_protein: "beef" });
      await createTestMeal(user.householdId, { name: "Meal C", main_protein: "fish" });

      const res = await request(app)
        .post("/api/v1/chooseWeeklyMeals")
        .set("Cookie", user.cookie)
        .send({ count: 2 });

      expect(res.status).toBe(200);
      expect(res.body.meals).toHaveLength(2);
      expect(res.body.meals[0].foodSelectionId).toBeDefined();
    });
  });

  describe("GET /api/v1/weeklySelections", () => {
    it("returns this week's selections", async () => {
      await createTestMeal(user.householdId, { name: "Meal A" });

      await request(app)
        .post("/api/v1/chooseWeeklyMeals")
        .set("Cookie", user.cookie)
        .send({ count: 1 });

      const res = await request(app)
        .get("/api/v1/weeklySelections")
        .set("Cookie", user.cookie);

      expect(res.status).toBe(200);
      expect(res.body.meals).toHaveLength(1);
      expect(res.body.meals[0].name).toBe("Meal A");
    });
  });

  describe("POST /api/v1/rejectFoodSelections", () => {
    it("rejects specified selections", async () => {
      await createTestMeal(user.householdId, { name: "Meal A" });

      const choose = await request(app)
        .post("/api/v1/chooseWeeklyMeals")
        .set("Cookie", user.cookie)
        .send({ count: 1 });

      const fsId = choose.body.meals[0].foodSelectionId;

      const res = await request(app)
        .post("/api/v1/rejectFoodSelections")
        .set("Cookie", user.cookie)
        .send({ foodSelectionIds: [fsId] });

      expect(res.status).toBe(200);
      expect(res.body.updated[0].status).toBe("rejected");

      // Verify it's gone from weekly selections
      const weekly = await request(app)
        .get("/api/v1/weeklySelections")
        .set("Cookie", user.cookie);
      expect(weekly.body.meals).toHaveLength(0);
    });

    it("returns 400 for empty array", async () => {
      const res = await request(app)
        .post("/api/v1/rejectFoodSelections")
        .set("Cookie", user.cookie)
        .send({ foodSelectionIds: [] });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/addMealToWeek", () => {
    it("adds a specific meal to the week", async () => {
      const mealId = await createTestMeal(user.householdId, { name: "Salmon Bowl" });

      const res = await request(app)
        .post("/api/v1/addMealToWeek")
        .set("Cookie", user.cookie)
        .send({ mealId });

      expect(res.status).toBe(200);
      expect(res.body.meal.name).toBe("Salmon Bowl");
      expect(res.body.meal.foodSelectionId).toBeDefined();
    });

    it("returns 409 for duplicate meal in same week", async () => {
      const mealId = await createTestMeal(user.householdId, { name: "Salmon Bowl" });

      await request(app)
        .post("/api/v1/addMealToWeek")
        .set("Cookie", user.cookie)
        .send({ mealId });

      const res = await request(app)
        .post("/api/v1/addMealToWeek")
        .set("Cookie", user.cookie)
        .send({ mealId });

      expect(res.status).toBe(409);
    });

    it("re-proposes a rejected meal", async () => {
      const mealId = await createTestMeal(user.householdId, { name: "Salmon Bowl" });

      // Add then reject
      const add = await request(app)
        .post("/api/v1/addMealToWeek")
        .set("Cookie", user.cookie)
        .send({ mealId });

      await request(app)
        .post("/api/v1/rejectFoodSelections")
        .set("Cookie", user.cookie)
        .send({ foodSelectionIds: [add.body.meal.foodSelectionId] });

      // Re-add
      const res = await request(app)
        .post("/api/v1/addMealToWeek")
        .set("Cookie", user.cookie)
        .send({ mealId });

      expect(res.status).toBe(200);
      expect(res.body.meal.name).toBe("Salmon Bowl");
    });
  });

  describe("POST /api/v1/copyWeekToCurrent", () => {
    // Inserts a non-rejected meal selection in a past week and returns its chosen_for_week
    async function seedPastWeek(householdId: number, mealId: number): Promise<string> {
      const result = await pool.query(
        `INSERT INTO food_selections (meal_id, household_id, status, chosen_for_week)
         VALUES ($1, $2, 'proposed', week_start_utc(NOW() - INTERVAL '14 days'))
         RETURNING to_char(chosen_for_week, 'YYYY-MM-DD') AS week_start`,
        [mealId, householdId]
      );
      return result.rows[0].week_start;
    }

    it("copies a past week's meals into this week", async () => {
      const mealA = await createTestMeal(user.householdId, { name: "Meal A" });
      const mealB = await createTestMeal(user.householdId, { name: "Meal B" });
      const weekStart = await seedPastWeek(user.householdId, mealA);
      await seedPastWeek(user.householdId, mealB);

      const res = await request(app)
        .post("/api/v1/copyWeekToCurrent")
        .set("Cookie", user.cookie)
        .send({ weekStart });

      expect(res.status).toBe(200);
      expect(res.body.added).toBe(2);

      const weekly = await request(app)
        .get("/api/v1/weeklySelections")
        .set("Cookie", user.cookie);
      const names = weekly.body.meals.map((m: any) => m.name).sort();
      expect(names).toEqual(["Meal A", "Meal B"]);
    });

    it("skips meals already in this week", async () => {
      const mealId = await createTestMeal(user.householdId, { name: "Meal A" });
      const weekStart = await seedPastWeek(user.householdId, mealId);

      // Already in this week
      await request(app)
        .post("/api/v1/addMealToWeek")
        .set("Cookie", user.cookie)
        .send({ mealId });

      const res = await request(app)
        .post("/api/v1/copyWeekToCurrent")
        .set("Cookie", user.cookie)
        .send({ weekStart });

      expect(res.status).toBe(200);
      expect(res.body.added).toBe(0);
    });

    it("returns 404 when the week has no meals", async () => {
      const res = await request(app)
        .post("/api/v1/copyWeekToCurrent")
        .set("Cookie", user.cookie)
        .send({ weekStart: "2020-01-06T00:00:00.000Z" });

      expect(res.status).toBe(404);
    });

    it("returns 400 when weekStart is missing", async () => {
      const res = await request(app)
        .post("/api/v1/copyWeekToCurrent")
        .set("Cookie", user.cookie)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/generateIngredients", () => {
    it("aggregates ingredients across meals", async () => {
      const meal1 = await createTestMeal(user.householdId, { name: "Meal 1" });
      const meal2 = await createTestMeal(user.householdId, { name: "Meal 2" });

      await createTestIngredients(meal1, [
        { name: "olive oil", quantity: 2, unit: "tbsp" },
        { name: "salt", quantity: 1, unit: "tsp" },
      ]);
      await createTestIngredients(meal2, [
        { name: "olive oil", quantity: 1, unit: "tbsp" },
        { name: "chicken", quantity: 1, unit: "lb" },
      ]);

      const res = await request(app)
        .post("/api/v1/generateIngredients")
        .set("Cookie", user.cookie)
        .send({ mealIds: [meal1, meal2] });

      expect(res.status).toBe(200);
      const ingredients = res.body.ingredients;
      expect(ingredients.length).toBeGreaterThanOrEqual(3);

      // olive oil should be aggregated (3 tbsp total)
      const oil = ingredients.find((i: any) => i.name === "olive oil");
      expect(oil).toBeDefined();
      expect(oil.quantity).toBe(3);
      expect(oil.measurementUnit).toBe("tbsp");
    });
  });
});
