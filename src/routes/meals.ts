import { Router, Response } from "express";
import pool from "../db";
import { Protein, MealSelection, ChooseWeeklyMealsResponse } from "../types";
import { toMeal } from "../mappers";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const LOOKBACK_WEEKS = 3;

// Ranking weights
const RATING_WEIGHT = 0.3;
const EASINESS_WEIGHT = 0.35;
const HEALTH_WEIGHT = 0.2;
const PROTEIN_VARIETY_BONUS = 2;
const PREFERRED_PROTEIN_BONUS = 1;
const PREFERRED_PROTEINS: Protein[] = ['chicken', 'turkey', 'fish'];

// POST /api/v1/chooseWeeklyMeals
// Body: { count?: number, includeAll?: boolean }
router.post("/chooseWeeklyMeals", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const count = req.body.count ?? 3;
  const includeAll = req.body.includeAll ?? false;

  try {
    // Find eligible meals, optionally ignoring the lookback window
    // Always exclude meals that are currently proposed/accepted this week
    const excludeCurrentQuery = `
      SELECT fs.meal_id
      FROM food_selections fs
      WHERE fs.meal_id IS NOT NULL
        AND fs.household_id = $1
        AND fs.chosen_at > NOW() - INTERVAL '1 week'
        AND fs.status != 'rejected'
    `;
    const eligibleMealsResult = includeAll
      ? await pool.query(`
        SELECT m.* FROM meals m
        WHERE m.household_id = $1
          AND m.id NOT IN (${excludeCurrentQuery})
      `, [householdId])
      : await pool.query(`
        SELECT m.*
        FROM meals m
        WHERE m.household_id = $1
          AND m.id NOT IN (
          SELECT fs.meal_id
          FROM food_selections fs
          WHERE fs.meal_id IS NOT NULL
            AND fs.household_id = $1
            AND fs.chosen_at > NOW() - INTERVAL '${LOOKBACK_WEEKS} weeks'
        )
      `, [householdId]);

    const eligible = eligibleMealsResult.rows.map(toMeal);

    if (eligible.length === 0) {
      const response: ChooseWeeklyMealsResponse = { meals: [] };
      res.json(response);
      return;
    }

    // Get proteins already selected this week to encourage rotation
    const thisWeekProteinsResult = await pool.query(`
      SELECT DISTINCT m.main_protein
      FROM food_selections fs
      JOIN meals m ON m.id = fs.meal_id
      WHERE fs.household_id = $1
        AND fs.chosen_at > NOW() - INTERVAL '1 week'
        AND fs.status != 'rejected'
        AND m.main_protein IS NOT NULL
    `, [householdId]);
    const usedProteins = new Set(
      thisWeekProteinsResult.rows.map((r) => r.main_protein)
    );

    // Rank meals by weighted score
    const ranked = eligible
      .map((meal) => {
        const varietyBonus = usedProteins.has(meal.mainProtein) ? 0 : PROTEIN_VARIETY_BONUS;
        const preferredBonus = meal.mainProtein && PREFERRED_PROTEINS.includes(meal.mainProtein) ? PREFERRED_PROTEIN_BONUS : 0;

        const score =
          meal.rating * RATING_WEIGHT +
          meal.easinessScore * EASINESS_WEIGHT +
          meal.healthScore * HEALTH_WEIGHT +
          varietyBonus +
          preferredBonus;

        return { ...meal, score };
      })
      .sort((a, b) => b.score - a.score);

    // Take top N meals
    const chosen = ranked.slice(0, count);

    // Insert into food_selections
    const insertedSelections: MealSelection[] = [];
    for (const meal of chosen) {
      const result = await pool.query(
        `INSERT INTO food_selections (meal_id, household_id, status) VALUES ($1, $2, 'proposed') RETURNING *`,
        [meal.id, householdId]
      );
      insertedSelections.push({
        ...meal,
        foodSelectionId: result.rows[0].id,
        selectionStatus: result.rows[0].status,
      });
    }

    const response: ChooseWeeklyMealsResponse = { meals: insertedSelections };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error choosing weekly meals:", err);
    res.status(500).json({ error: "Failed to choose weekly meals", details: message });
  }
});

export default router;
