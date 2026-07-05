import pool from "../db";
import { Meal, MealSelection, HouseholdSettings } from "../types";
import { toMeal } from "../mappers";

const PROTEIN_VARIETY_BONUS = 2;
const PREFERRED_PROTEIN_BONUS = 1;

export function rankMeals(meals: Meal[], settings: HouseholdSettings, usedProteins: Set<string | null>) {
  return meals
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
}

async function getHouseholdSettings(householdId: number): Promise<HouseholdSettings> {
  const result = await pool.query(
    `SELECT lookback_weeks, rating_weight, easiness_weight, health_weight,
            preferred_proteins, default_meal_count, basic_meal_count
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
    basicMealCount: row.basic_meal_count,
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
         AND chosen_for_week = active_week_start()
         AND status != 'rejected'`,
      [householdId]
    );
    const existingCount = Number(existingResult.rows[0].count);
    needed = Math.max(0, settings.defaultMealCount - existingCount);
  }

  if (needed === 0) return [];

  // Exclude meals selected in the last N weeks
  const lookbackExcludeQuery = `
    SELECT fs.meal_id
    FROM food_selections fs
    WHERE fs.meal_id IS NOT NULL
      AND fs.household_id = $1
      AND fs.chosen_for_week > active_week_start() - INTERVAL '${settings.lookbackWeeks} weeks'
  `;

  // Exclude anything chosen or rejected this week
  const excludeCurrentQuery = `
    SELECT fs.meal_id
    FROM food_selections fs
    WHERE fs.meal_id IS NOT NULL
      AND fs.household_id = $1
      AND fs.chosen_for_week = active_week_start()
  `;

  // Fetch basic meals with lookback; fall back to no lookback if none are eligible
  let basicMealsResult = includeAll
    ? await pool.query(
        `SELECT m.* FROM meals m
         WHERE m.household_id = $1
           AND m.is_basic = TRUE
           AND m.is_archived = FALSE
           AND m.id NOT IN (${excludeCurrentQuery})`,
        [householdId]
      )
    : await pool.query(
        `SELECT m.* FROM meals m
         WHERE m.household_id = $1
           AND m.is_basic = TRUE
           AND m.is_archived = FALSE
           AND m.id NOT IN (${lookbackExcludeQuery})`,
        [householdId]
      );
  // If lookback left no basic meals, fall back to only excluding this week
  if (!includeAll && basicMealsResult.rows.length === 0) {
    basicMealsResult = await pool.query(
      `SELECT m.* FROM meals m
       WHERE m.household_id = $1
         AND m.is_basic = TRUE
         AND m.is_archived = FALSE
         AND m.id NOT IN (${excludeCurrentQuery})`,
      [householdId]
    );
  }

  // Fetch non-basic meals with lookback restriction
  const regularMealsResult = includeAll
    ? await pool.query(
        `SELECT m.* FROM meals m
         WHERE m.household_id = $1
           AND m.is_basic = FALSE
           AND m.is_archived = FALSE
           AND m.id NOT IN (${excludeCurrentQuery})`,
        [householdId]
      )
    : await pool.query(
        `SELECT m.*
         FROM meals m
         WHERE m.household_id = $1
           AND m.is_basic = FALSE
           AND m.is_archived = FALSE
           AND m.id NOT IN (${lookbackExcludeQuery})`,
        [householdId]
      );

  const basicEligible = basicMealsResult.rows.map(toMeal);
  const regularEligible = regularMealsResult.rows.map(toMeal);

  if (basicEligible.length === 0 && regularEligible.length === 0) {
    return [];
  }

  const thisWeekProteinsResult = await pool.query(
    `SELECT DISTINCT m.main_protein
     FROM food_selections fs
     JOIN meals m ON m.id = fs.meal_id
     WHERE fs.household_id = $1
       AND fs.chosen_for_week = active_week_start()
       AND fs.status != 'rejected'
       AND m.main_protein IS NOT NULL`,
    [householdId]
  );
  const usedProteins = new Set(
    thisWeekProteinsResult.rows.map((r) => r.main_protein)
  );

  const rankedBasic = rankMeals(basicEligible, settings, usedProteins);
  const rankedRegular = rankMeals(regularEligible, settings, usedProteins);

  // Check how many basics are already chosen this week
  const existingBasicResult = await pool.query(
    `SELECT COUNT(*) FROM food_selections fs
     JOIN meals m ON m.id = fs.meal_id
     WHERE fs.household_id = $1 AND fs.meal_id IS NOT NULL
       AND m.is_basic = TRUE
       AND fs.chosen_for_week = active_week_start()
       AND fs.status != 'rejected'`,
    [householdId]
  );
  const existingBasicCount = Number(existingBasicResult.rows[0].count);

  // Only fill up to basicMealCount basics total (including already chosen ones)
  const basicStillNeeded = Math.max(0, settings.basicMealCount - existingBasicCount);
  const basicNeeded = Math.min(basicStillNeeded, needed, rankedBasic.length);
  const regularNeeded = needed - basicNeeded;

  const chosenBasic = rankedBasic.slice(0, basicNeeded);
  const chosenRegular = rankedRegular.slice(0, regularNeeded);

  // If we couldn't fill enough regular meals, try to fill from basics (and vice versa)
  let chosen = [...chosenBasic, ...chosenRegular];
  if (chosen.length < needed) {
    const remaining = needed - chosen.length;
    const chosenIds = new Set(chosen.map((m) => m.id));
    const extras = [...rankedBasic, ...rankedRegular]
      .filter((m) => !chosenIds.has(m.id))
      .slice(0, remaining);
    chosen = [...chosen, ...extras];
  }

  const insertedSelections: MealSelection[] = [];
  for (const meal of chosen) {
    const result = await pool.query(
      `INSERT INTO food_selections (meal_id, household_id, status, chosen_for_week)
       VALUES ($1, $2, 'proposed', active_week_start()) RETURNING *`,
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
