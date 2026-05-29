import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { cleanDatabase, closeDatabase, createTestUser, createTestMeal, createTestIngredients } from "../../test/setup";

describe("Recipe routes", () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe("POST /api/v1/saveRecipe", () => {
    it("saves a recipe with ingredients", async () => {
      const res = await request(app)
        .post("/api/v1/saveRecipe")
        .set("Cookie", user.cookie)
        .send({
          name: "Chicken Stir Fry",
          rating: 8,
          easinessScore: 7,
          healthScore: 9,
          servingSize: 4,
          mainProtein: "chicken",
          description: "A quick stir fry",
          ingredients: [
            { name: "chicken", quantity: 1, measurementUnit: "lb", optional: false, notes: "diced" },
            { name: "soy sauce", quantity: 2, measurementUnit: "tbsp", optional: false, notes: null },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.mealId).toBeDefined();
    });

    it("returns 400 for missing required fields", async () => {
      const res = await request(app)
        .post("/api/v1/saveRecipe")
        .set("Cookie", user.cookie)
        .send({ name: "Incomplete" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/allMeals", () => {
    it("returns all meals with ingredients for the household", async () => {
      const mealId = await createTestMeal(user.householdId, { name: "Test Meal" });
      await createTestIngredients(mealId, [
        { name: "garlic", quantity: 3, unit: "cloves" },
      ]);

      const res = await request(app)
        .get("/api/v1/allMeals")
        .set("Cookie", user.cookie);

      expect(res.status).toBe(200);
      expect(res.body.meals).toHaveLength(1);
      expect(res.body.meals[0].name).toBe("Test Meal");
      expect(res.body.meals[0].ingredients).toHaveLength(1);
      expect(res.body.meals[0].ingredients[0].name).toBe("garlic");
    });

    it("does not return meals from other households", async () => {
      const otherUser = await createTestUser("other@test.com", "Other Household");
      await createTestMeal(otherUser.householdId, { name: "Other Meal" });
      await createTestMeal(user.householdId, { name: "My Meal" });

      const res = await request(app)
        .get("/api/v1/allMeals")
        .set("Cookie", user.cookie);

      expect(res.body.meals).toHaveLength(1);
      expect(res.body.meals[0].name).toBe("My Meal");
    });
  });

  describe("PATCH /api/v1/meals/:id", () => {
    it("partially updates a meal", async () => {
      const mealId = await createTestMeal(user.householdId, {
        name: "Original Name",
        main_protein: "chicken",
      });

      const res = await request(app)
        .patch(`/api/v1/meals/${mealId}`)
        .set("Cookie", user.cookie)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.meal.name).toBe("Updated Name");
      expect(res.body.meal.mainProtein).toBe("chicken"); // unchanged
    });

    it("returns 404 for meal from another household", async () => {
      const otherUser = await createTestUser("other@test.com", "Other Household");
      const mealId = await createTestMeal(otherUser.householdId, { name: "Other Meal" });

      const res = await request(app)
        .patch(`/api/v1/meals/${mealId}`)
        .set("Cookie", user.cookie)
        .send({ name: "Hijacked" });

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/v1/meals/:id/ingredients", () => {
    it("replaces ingredients for a meal", async () => {
      const mealId = await createTestMeal(user.householdId, { name: "Test Meal" });
      await createTestIngredients(mealId, [
        { name: "old ingredient", quantity: 1, unit: "whole" },
      ]);

      const res = await request(app)
        .put(`/api/v1/meals/${mealId}/ingredients`)
        .set("Cookie", user.cookie)
        .send({
          ingredients: [
            { name: "new ingredient", quantity: 2, measurementUnit: "cups", optional: false, notes: null },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.ingredients).toHaveLength(1);
      expect(res.body.ingredients[0].name).toBe("new ingredient");
    });
  });
});
