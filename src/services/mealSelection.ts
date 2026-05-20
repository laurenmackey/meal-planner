import pool from "../db";
import { MealSelection, HouseholdSettings } from "../types";
import { toMeal } from "../mappers";

const PROTEIN_VARIETY_BONUS = 2;
const PREFERRED_PROTEIN_BONUS = 1;

async function getHouseholdSettings(householdId: number): Promise<HouseholdSettings> {
  const result = await pool.query(
    `SELECT lookback_weeks, rating_weight, easiness_weight, health_weight,
            preferred_proteins, default_meal_count
     FROM households WHERE id = $1`,
    [householdId]
  );
  if (result.rows.length === 0) {
    throw new Error(`Household ${householdId} not found`);
  }
  const row = result.rows[0];
  return {
    lookbackWeeks: row.lookback_weeks,
    ratingWeight: Number(row.rating_weight),
    easinessWeight: Number(row.easiness_weight),
    healthWeight: Number(row.health_weight),
    preferredProteins: row.preferred_proteins,
    defaultMealCount: row.default_meal_count,
  };
}

export async function chooseWeeklyMeals(
  householdId: number,
  count?: number,
  includeAll = false
): Promise<MealSelection[]> {
  const settings = await getHouseholdSettings(householdId);

  let needed: number;
  if (count != null) {
    // Explicit count: generate exactly this many new meals
    needed = count;
  } else {
    // No count (cron job): fill up to defaultMealCount for the week
    const existingResult = await pool.query(
      `SELECT COUNT(*) FROM food_selections
       WHERE household_id = $1 AND meal_id IS NOT NULL
         AND week_start_utc(chosen_at) = week_start_utc(NOW())
         AND status != 'rejected'`,
      [householdId]
    );
    const existingCount = Number(existingResult.rows[0].count);
    needed = Math.max(0, settings.defaultMealCount - existingCount);
  }

  if (needed === 0) return [];

  const excludeCurrentQuery = `
    SELECT fs.meal_id
    FROM food_selections fs
    WHERE fs.meal_id IS NOT NULL
      AND fs.household_id = $1
      AND week_start_utc(fs.chosen_at) = week_start_utc(NOW())
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
             AND fs.chosen_at > NOW() - INTERVAL '${settings.lookbackWeeks} weeks'
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
       AND week_start_utc(fs.chosen_at) = week_start_utc(NOW())
       AND fs.status != 'rejected'
       AND m.main_protein IS NOT NULL`,
    [householdId]
  );
  const usedProteins = new Set(
    thisWeekProteinsResult.rows.map((r) => r.main_protein)
  );

  const ranked = eligible
    .map((meal) => {
      const varietyBonus = usedProteins.has(meal.mainProtein) ? 0 : PROTEIN_VARIETY_BONUS;
      const preferredBonus =
        meal.mainProtein && settings.preferredProteins.includes(meal.mainProtein) ? PREFERRED_PROTEIN_BONUS : 0;

      const score =
        meal.rating * settings.ratingWeight +
        meal.easinessScore * settings.easinessWeight +
        meal.healthScore * settings.healthWeight +
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
