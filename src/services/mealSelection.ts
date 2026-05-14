import pool from "../db";
import { Protein, MealSelection } from "../types";
import { toMeal } from "../mappers";

export const DEFAULT_MEAL_COUNT = 3;
const LOOKBACK_WEEKS = 3;
const RATING_WEIGHT = 0.3;
const EASINESS_WEIGHT = 0.35;
const HEALTH_WEIGHT = 0.2;
const PROTEIN_VARIETY_BONUS = 2;
const PREFERRED_PROTEIN_BONUS = 1;
const PREFERRED_PROTEINS: Protein[] = ["chicken", "turkey", "fish"];

export async function chooseWeeklyMeals(
  householdId: number,
  count = DEFAULT_MEAL_COUNT,
  includeAll = false
): Promise<MealSelection[]> {
  // Check how many non-rejected meals already exist this week
  const existingResult = await pool.query(
    `SELECT COUNT(*) FROM food_selections
     WHERE household_id = $1 AND meal_id IS NOT NULL
       AND chosen_at >= DATE_TRUNC('week', CURRENT_DATE)
       AND status != 'rejected'`,
    [householdId]
  );
  const existingCount = Number(existingResult.rows[0].count);
  const needed = Math.max(0, count - existingCount);

  if (needed === 0) return [];

  const excludeCurrentQuery = `
    SELECT fs.meal_id
    FROM food_selections fs
    WHERE fs.meal_id IS NOT NULL
      AND fs.household_id = $1
      AND fs.chosen_at >= DATE_TRUNC('week', CURRENT_DATE)
      AND fs.status != 'rejected'
  `;
  const eligibleMealsResult = includeAll
    ? await pool.query(
        `SELECT m.* FROM meals m
         WHERE m.household_id = $1
           AND m.id NOT IN (${excludeCurrentQuery})`,
        [householdId]
      )
    : await pool.query(
        `SELECT m.*
         FROM meals m
         WHERE m.household_id = $1
           AND m.id NOT IN (
           SELECT fs.meal_id
           FROM food_selections fs
           WHERE fs.meal_id IS NOT NULL
             AND fs.household_id = $1
             AND fs.chosen_at > NOW() - INTERVAL '${LOOKBACK_WEEKS} weeks'
         )`,
        [householdId]
      );

  const eligible = eligibleMealsResult.rows.map(toMeal);

  if (eligible.length === 0) {
    return [];
  }

  const thisWeekProteinsResult = await pool.query(
    `SELECT DISTINCT m.main_protein
     FROM food_selections fs
     JOIN meals m ON m.id = fs.meal_id
     WHERE fs.household_id = $1
       AND fs.chosen_at >= DATE_TRUNC('week', CURRENT_DATE)
       AND fs.status != 'rejected'
       AND m.main_protein IS NOT NULL`,
    [householdId]
  );
  const usedProteins = new Set(
    thisWeekProteinsResult.rows.map((r) => r.main_protein)
  );

  const ranked = eligible
    .map((meal) => {
      const varietyBonus = usedProteins.has(meal.mainProtein)
        ? 0
        : PROTEIN_VARIETY_BONUS;
      const preferredBonus =
        meal.mainProtein && PREFERRED_PROTEINS.includes(meal.mainProtein)
          ? PREFERRED_PROTEIN_BONUS
          : 0;

      const score =
        meal.rating * RATING_WEIGHT +
        meal.easinessScore * EASINESS_WEIGHT +
        meal.healthScore * HEALTH_WEIGHT +
        varietyBonus +
        preferredBonus;

      return { ...meal, score };
    })
    .sort((a, b) => b.score - a.score);

  const chosen = ranked.slice(0, needed);

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
      servingSizeMultiplier: 1,
    });
  }

  return insertedSelections;
}
