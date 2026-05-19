import { Router, Response } from "express";
import pool from "../db";
import { MealSelection, StapleSelection, AggregatedIngredient, ChooseWeeklyMealsResponse, RejectFoodSelectionsResponse } from "../types";
import { toMeal, toFoodSelection } from "../mappers";
import { authenticate, AuthRequest } from "../middleware/auth";
import { chooseWeeklyStaples } from "../services/stapleSelection";

const router = Router();

// Unit conversion: convert compatible units to a common base before aggregating
// Volume (US): base = tsp  (1 tbsp = 3 tsp, 1 cup = 48 tsp)
// Weight (US): base = oz   (1 lb = 16 oz)
// Metric weight: base = g  (no other metric weight units currently)
// Metric volume: base = ml (1 l = 1000 ml)
const UNIT_GROUPS: Record<string, { base: string; units: Record<string, number> }> = {
  volume: { base: "tsp", units: { tsp: 1, tbsp: 3, cups: 48 } },
  weight: { base: "oz", units: { oz: 1, lb: 16 } },
  metric_weight: { base: "g", units: { g: 1 } },
  metric_volume: { base: "ml", units: { ml: 1, l: 1000 } },
};

// Map each unit to its group
const UNIT_TO_GROUP: Record<string, { group: string; factor: number }> = {};
for (const [groupName, group] of Object.entries(UNIT_GROUPS)) {
  for (const [unit, factor] of Object.entries(group.units)) {
    UNIT_TO_GROUP[unit] = { group: groupName, factor };
  }
}

// Pick the best display unit: use the largest unit where quantity >= 1
function bestDisplayUnit(baseQuantity: number, groupName: string): { quantity: number; unit: string } {
  const group = UNIT_GROUPS[groupName];
  const sorted = Object.entries(group.units).sort((a, b) => b[1] - a[1]); // largest first
  for (const [unit, factor] of sorted) {
    const converted = baseQuantity / factor;
    if (converted >= 1) {
      return { quantity: Math.round(converted * 100) / 100, unit };
    }
  }
  return { quantity: Math.round(baseQuantity * 100) / 100, unit: group.base };
}

// GET /api/v1/weeklySelections
// Returns this week's non-rejected meal selections
router.get("/weeklySelections", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  try {
    const result = await pool.query(`
      SELECT m.*, fs.id AS food_selection_id, fs.status AS selection_status,
             fs.serving_size_multiplier
      FROM food_selections fs
      JOIN meals m ON m.id = fs.meal_id
      WHERE fs.household_id = $1
        AND week_start_utc(fs.chosen_at) = week_start_utc(NOW())
        AND fs.status != 'rejected'
    `, [householdId]);

    const meals: MealSelection[] = result.rows.map((row) => ({
      ...toMeal(row),
      foodSelectionId: row.food_selection_id,
      selectionStatus: row.selection_status,
      servingSizeMultiplier: Number(row.serving_size_multiplier),
      score: 0,
    }));

    const response: ChooseWeeklyMealsResponse = { meals };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching weekly selections:", err);
    res.status(500).json({ error: "Failed to fetch weekly selections", details: message });
  }
});

// POST /api/v1/rejectFoodSelections
// Body: { foodSelectionIds: number[] }
router.post("/rejectFoodSelections", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const { foodSelectionIds } = req.body;

  if (!Array.isArray(foodSelectionIds) || foodSelectionIds.length === 0) {
    res.status(400).json({ error: "foodSelectionIds must be a non-empty array" });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE food_selections
       SET status = 'rejected', updated_at = NOW()
       WHERE id = ANY($1) AND household_id = $2
       RETURNING *`,
      [foodSelectionIds, householdId]
    );

    const response: RejectFoodSelectionsResponse = { updated: result.rows.map(toFoodSelection) };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error rejecting food items:", err);
    res.status(500).json({ error: "Failed to reject food items", details: message });
  }
});

// GET /api/v1/allStaples
// Returns all food_staples for the household
router.get("/allStaples", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  try {
    const result = await pool.query(
      "SELECT id, name, description, notes FROM food_staples WHERE household_id = $1 ORDER BY name ASC",
      [householdId]
    );
    res.json({ staples: result.rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching staples:", err);
    res.status(500).json({ error: "Failed to fetch staples", details: message });
  }
});

// POST /api/v1/addWeeklyStaple
// Body: { foodStapleId: number }
// Adds a single staple to this week's food_selections
router.post("/addWeeklyStaple", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const { foodStapleId } = req.body;

  if (!foodStapleId) {
    res.status(400).json({ error: "foodStapleId is required" });
    return;
  }

  try {
    // Check if already exists this week (including rejected — re-propose it)
    const existing = await pool.query(
      `SELECT id, status FROM food_selections
       WHERE food_staple_id = $1 AND household_id = $2
         AND week_start_utc(chosen_at) = week_start_utc(NOW())`,
      [foodStapleId, householdId]
    );

    let foodSelectionId: number;
    if (existing.rows.length > 0) {
      // Re-propose if rejected
      await pool.query(
        `UPDATE food_selections SET status = 'proposed', updated_at = NOW() WHERE id = $1`,
        [existing.rows[0].id]
      );
      foodSelectionId = existing.rows[0].id;
    } else {
      const insertResult = await pool.query(
        `INSERT INTO food_selections (food_staple_id, household_id, status)
         VALUES ($1, $2, 'proposed')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [foodStapleId, householdId]
      );
      foodSelectionId = insertResult.rows[0]?.id;
    }

    const stapleData = await pool.query(
      "SELECT id, name, description, notes FROM food_staples WHERE id = $1",
      [foodStapleId]
    );

    const staple: StapleSelection = {
      ...stapleData.rows[0],
      foodSelectionId,
      selectionStatus: "proposed",
    };

    res.json({ staple });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error adding staple:", err);
    res.status(500).json({ error: "Failed to add staple", details: message });
  }
});

// POST /api/v1/chooseWeeklyStaples
// Adds all food_staples for the household into food_selections for this week
router.post("/chooseWeeklyStaples", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  try {
    const { restore } = req.body || {};
    const staples = await chooseWeeklyStaples(householdId, restore === true);
    res.json({ staples });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error choosing weekly staples:", err);
    res.status(500).json({ error: "Failed to choose weekly staples", details: message });
  }
});

// GET /api/v1/weeklyStaples
// Returns this week's non-rejected staple selections
router.get("/weeklyStaples", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  try {
    const result = await pool.query(`
      SELECT s.id, s.name, s.description, s.notes,
             fs.id AS food_selection_id, fs.status AS selection_status
      FROM food_selections fs
      JOIN food_staples s ON s.id = fs.food_staple_id
      WHERE fs.household_id = $1
        AND week_start_utc(fs.chosen_at) = week_start_utc(NOW())
        AND fs.status != 'rejected'
      ORDER BY s.name ASC
    `, [householdId]);

    const staples: StapleSelection[] = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      notes: row.notes,
      foodSelectionId: row.food_selection_id,
      selectionStatus: row.selection_status,
    }));

    res.json({ staples });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching weekly staples:", err);
    res.status(500).json({ error: "Failed to fetch weekly staples", details: message });
  }
});

// POST /api/v1/generateIngredients
// Body: { mealIds: number[], multipliers?: Record<number, number> }
// Returns aggregated ingredients across all meals
router.post("/generateIngredients", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const { mealIds, multipliers } = req.body;

  if (!Array.isArray(mealIds) || mealIds.length === 0) {
    res.status(400).json({ error: "mealIds must be a non-empty array" });
    return;
  }

  try {
    // Save multipliers and build mealId -> multiplier map
    const mealMultipliers: Record<number, number> = {};
    if (multipliers && typeof multipliers === "object") {
      for (const [foodSelectionId, multiplier] of Object.entries(multipliers)) {
        const updateResult = await pool.query(
          `UPDATE food_selections
           SET serving_size_multiplier = $1, updated_at = NOW()
           WHERE id = $2 AND household_id = $3
           RETURNING meal_id`,
          [multiplier, Number(foodSelectionId), householdId]
        );
        if (updateResult.rows.length > 0) {
          mealMultipliers[updateResult.rows[0].meal_id] = multiplier as number;
        }
      }
    }

    const result = await pool.query(
      `SELECT i.*, m.name AS meal_name
       FROM ingredients i
       JOIN meals m ON m.id = i.meal_id
       WHERE i.meal_id = ANY($1) AND m.household_id = $2
      ORDER BY i.optional ASC, i.name ASC`,
      [mealIds, householdId]
    );

    // Aggregate by name, converting compatible units to a common base
    // For convertible units: aggregate in base units, then pick best display unit
    // For non-convertible units (whole, cloves, pinch, to_taste): aggregate by name + unit
    const baseAggregated: Record<string, { name: string; baseQuantity: number; group: string; sources: string[]; optional: boolean }> = {};
    const directAggregated: Record<string, AggregatedIngredient> = {};

    for (const row of result.rows) {
      const multiplier = mealMultipliers[row.meal_id] || 1;
      const quantity = Number(row.quantity) * multiplier;
      const unitInfo = UNIT_TO_GROUP[row.measurement_unit];

      if (unitInfo) {
        // Convertible unit — aggregate in base units by name + group
        const key = `${row.name}::${unitInfo.group}`;
        if (!baseAggregated[key]) {
          baseAggregated[key] = { name: row.name, baseQuantity: 0, group: unitInfo.group, sources: [], optional: true };
        }
        baseAggregated[key].baseQuantity += quantity * unitInfo.factor;
        if (!row.optional) baseAggregated[key].optional = false;
        if (!baseAggregated[key].sources.includes(row.meal_name)) {
          baseAggregated[key].sources.push(row.meal_name);
        }
      } else {
        // Non-convertible unit — aggregate by name + unit directly
        const key = `${row.name}::${row.measurement_unit}`;
        if (!directAggregated[key]) {
          directAggregated[key] = { name: row.name, quantity: 0, measurementUnit: row.measurement_unit, sources: [], optional: true };
        }
        directAggregated[key].quantity += quantity;
        if (!row.optional) directAggregated[key].optional = false;
        if (!directAggregated[key].sources.includes(row.meal_name)) {
          directAggregated[key].sources.push(row.meal_name);
        }
      }
    }

    // Convert base-aggregated back to best display units
    const convertedIngredients: AggregatedIngredient[] = Object.values(baseAggregated).map((entry) => {
      const { quantity, unit } = bestDisplayUnit(entry.baseQuantity, entry.group);
      return { name: entry.name, quantity, measurementUnit: unit as AggregatedIngredient["measurementUnit"], sources: entry.sources, optional: entry.optional };
    });

    const ingredients = [...convertedIngredients, ...Object.values(directAggregated)]
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ ingredients });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error generating ingredients:", err);
    res.status(500).json({ error: "Failed to generate ingredients", details: message });
  }
});

// GET /api/v1/mealHistory
// Returns past weeks' accepted/proposed meal selections grouped by week
router.get("/mealHistory", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  try {
    const result = await pool.query(`
      SELECT m.*, fs.id AS food_selection_id, fs.status AS selection_status,
             fs.chosen_at, fs.serving_size_multiplier,
             DATE_TRUNC('week', fs.chosen_at) AS week_start
      FROM food_selections fs
      JOIN meals m ON m.id = fs.meal_id
      WHERE fs.household_id = $1
        AND fs.status != 'rejected'
      ORDER BY fs.chosen_at DESC
    `, [householdId]);

    // Group by week
    const weeks: Record<string, { weekStart: string; meals: MealSelection[] }> = {};
    for (const row of result.rows) {
      const weekKey = row.week_start.toISOString();
      if (!weeks[weekKey]) {
        weeks[weekKey] = { weekStart: weekKey, meals: [] };
      }
      weeks[weekKey].meals.push({
        ...toMeal(row),
        foodSelectionId: row.food_selection_id,
        selectionStatus: row.selection_status,
        servingSizeMultiplier: Number(row.serving_size_multiplier),
        score: 0,
      });
    }

    res.json({ weeks: Object.values(weeks) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching meal history:", err);
    res.status(500).json({ error: "Failed to fetch meal history", details: message });
  }
});

export default router;
