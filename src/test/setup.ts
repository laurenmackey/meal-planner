import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import pool from "../db";
import { AuthPayload, COOKIE_NAME } from "../middleware/auth";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export async function cleanDatabase() {
  await pool.query(`
    TRUNCATE food_selections, ingredients, meals, food_staples, users, households
    RESTART IDENTITY CASCADE
  `);
}

export async function closeDatabase() {
  await pool.end();
}

export interface TestUser {
  userId: number;
  email: string;
  householdId: number;
  cookie: string;
}

export async function createTestUser(
  email = "test@example.com",
  householdName = "Test Household"
): Promise<TestUser> {
  const householdResult = await pool.query(
    "INSERT INTO households (name, invite_code) VALUES ($1, $2) RETURNING id",
    [householdName, Math.random().toString(36).slice(2, 10)]
  );
  const householdId = householdResult.rows[0].id;

  const passwordHash = await bcrypt.hash("password123", 1);
  const userResult = await pool.query(
    "INSERT INTO users (email, password_hash, household_id) VALUES ($1, $2, $3) RETURNING id",
    [email, passwordHash, householdId]
  );
  const userId = userResult.rows[0].id;

  const payload: AuthPayload = { userId, email, householdId };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
  const cookie = `${COOKIE_NAME}=${token}`;

  return { userId, email, householdId, cookie };
}

export async function createTestMeal(
  householdId: number,
  overrides: Record<string, any> = {}
) {
  const defaults = {
    name: `Test Meal ${Date.now()}`,
    rating: 7,
    easiness_score: 6,
    health_score: 7,
    serving_size: 4,
    main_protein: "chicken",
    is_basic: false,
    is_archived: false,
  };
  const fields = { ...defaults, ...overrides };

  const result = await pool.query(
    `INSERT INTO meals (name, rating, easiness_score, health_score, serving_size, main_protein, household_id, is_basic, is_archived)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [fields.name, fields.rating, fields.easiness_score, fields.health_score, fields.serving_size, fields.main_protein, householdId, fields.is_basic, fields.is_archived]
  );
  return result.rows[0].id as number;
}

export async function createTestIngredients(mealId: number, ingredients: Array<{ name: string; quantity: number; unit: string }>) {
  for (const ing of ingredients) {
    await pool.query(
      `INSERT INTO ingredients (meal_id, name, quantity, measurement_unit, optional)
       VALUES ($1, $2, $3, $4, FALSE)`,
      [mealId, ing.name, ing.quantity, ing.unit]
    );
  }
}
