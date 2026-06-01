import { Router, Response } from "express";
import pool from "../db";
import { MealSelection, StapleSelection, AggregatedIngredient, ChooseWeeklyMealsResponse, RejectFoodSelectionsResponse } from "../types";
import { toMeal, toFoodSelection } from "../mappers";
import { authenticate, AuthRequest } from "../middleware/auth";
import { chooseWeeklyStaples } from "../services/stapleSelection";
import { UNIT_TO_GROUP, bestDisplayUnit } from "../utils/unitConversion";

const router = Router();

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
        AND fs.chosen_for_week = active_week_start()
        AND fs.status != 'rejected'
      ORDER BY m.name ASC
    `, [householdId]);

    const meals: MealSelection[] = result.rows.map((row) => ({
      ...toMeal(row),
      foodSelectionId: row.food_selection_id,
      selectionStatus: row.selection_status,
      servingSizeMultiplier: Number(row.serving_size_multiplier),
      score: 0,
    }));

    // The active week hasn't started until Monday 00:00 Pacific. Until then these
    // are "next week's" meals (shown over the weekend after the Friday cron).
    const weekStarted = await pool.query(
      `SELECT (active_week_start()::timestamp AT TIME ZONE 'America/Los_Angeles') > NOW() AS is_next_week`
    );

    const response: ChooseWeeklyMealsResponse = {
      meals,
      isNextWeek: weekStarted.rows[0].is_next_week,
    };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching weekly selections:", err);
    res.status(500).json({ error: "Failed to fetch weekly selections", details: message });
  }
});

// POST /api/v1/addMealToWeek
// Body: { mealId: number }
// Manually add a specific meal to this week's selections
router.post("/addMealToWeek", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const { mealId } = req.body;

  if (!mealId || typeof mealId !== "number") {
    res.status(400).json({ error: "mealId is required" });
    return;
  }

  try {
    // Verify the meal belongs to this household
    const mealResult = await pool.query(
      "SELECT * FROM meals WHERE id = $1 AND household_id = $2",
      [mealId, householdId]
    );
    if (mealResult.rows.length === 0) {
      res.status(404).json({ error: "Meal not found" });
      return;
    }

    // Check if already selected this week (including rejected — re-propose it)
    const existing = await pool.query(
      `SELECT id, status FROM food_selections
       WHERE meal_id = $1 AND household_id = $2
         AND chosen_for_week = active_week_start()`,
      [mealId, householdId]
    );

    let foodSelectionId: number;
    if (existing.rows.length > 0) {
      if (existing.rows[0].status !== "rejected") {
        res.status(409).json({ error: "This meal is already in this week's selections" });
        return;
      }
      await pool.query(
        `UPDATE food_selections SET status = 'proposed', updated_at = NOW() WHERE id = $1`,
        [existing.rows[0].id]
      );
      foodSelectionId = existing.rows[0].id;
    } else {
      const insertResult = await pool.query(
        `INSERT INTO food_selections (meal_id, household_id, status, chosen_for_week)
         VALUES ($1, $2, 'proposed', active_week_start()) RETURNING id`,
        [mealId, householdId]
      );
      foodSelectionId = insertResult.rows[0].id;
    }

    const meal: MealSelection = {
      ...toMeal(mealResult.rows[0]),
      foodSelectionId,
      selectionStatus: "proposed",
      servingSizeMultiplier: 1,
      score: 0,
    };

    res.json({ meal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error adding meal to week:", err);
    res.status(500).json({ error: "Failed to add meal to week", details: message });
  }
});

// POST /api/v1/copyWeekToCurrent
// Body: { weekStart: string }
// Copies all non-rejected meals from a past week into this week's selections.
// Meals already present this week (non-rejected) are skipped; rejected ones are re-proposed.
router.post("/copyWeekToCurrent", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const { weekStart } = req.body;

  if (!weekStart || typeof weekStart !== "string") {
    res.status(400).json({ error: "weekStart is required" });
    return;
  }

  try {
    // Find the distinct meals selected (non-rejected) during the source week.
    // Display order is by meal name everywhere, so insertion order doesn't matter here.
    const sourceMeals = await pool.query(
      `SELECT DISTINCT fs.meal_id
       FROM food_selections fs
       WHERE fs.household_id = $1
         AND fs.meal_id IS NOT NULL
         AND fs.status != 'rejected'
         AND fs.chosen_for_week = $2`,
      [householdId, weekStart]
    );

    if (sourceMeals.rows.length === 0) {
      res.status(404).json({ error: "No meals found for that week" });
      return;
    }

    let added = 0;
    for (const { meal_id } of sourceMeals.rows) {
      const existing = await pool.query(
        `SELECT id, status FROM food_selections
         WHERE meal_id = $1 AND household_id = $2
           AND chosen_for_week = active_week_start()`,
        [meal_id, householdId]
      );

      if (existing.rows.length > 0) {
        if (existing.rows[0].status === "rejected") {
          await pool.query(
            `UPDATE food_selections SET status = 'proposed', updated_at = NOW() WHERE id = $1`,
            [existing.rows[0].id]
          );
          added++;
        }
        // Already present and not rejected — skip
        continue;
      }

      await pool.query(
        `INSERT INTO food_selections (meal_id, household_id, status, chosen_for_week)
         VALUES ($1, $2, 'proposed', active_week_start())`,
        [meal_id, householdId]
      );
      added++;
    }

    res.json({ added });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error copying week to current:", err);
    res.status(500).json({ error: "Failed to copy week to current", details: message });
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

// POST /api/v1/staples
// Create a new food staple
router.post("/staples", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const { name } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO food_staples (name, household_id) VALUES ($1, $2) RETURNING id, name, description, notes`,
      [name.trim(), householdId]
    );
    res.json({ staple: result.rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error creating staple:", err);
    res.status(500).json({ error: "Failed to create staple", details: message });
  }
});

// PUT /api/v1/staples/:id
// Update a food staple
router.put("/staples/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const stapleId = Number(req.params.id);
  const { name } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE food_staples SET name = $1 WHERE id = $2 AND household_id = $3 RETURNING id, name, description, notes`,
      [name.trim(), stapleId, householdId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Staple not found" });
      return;
    }
    res.json({ staple: result.rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error updating staple:", err);
    res.status(500).json({ error: "Failed to update staple", details: message });
  }
});

// DELETE /api/v1/staples/:id
// Delete a food staple and its food_selections
router.delete("/staples/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const stapleId = Number(req.params.id);

  try {
    await pool.query(
      "DELETE FROM food_selections WHERE food_staple_id = $1 AND household_id = $2",
      [stapleId, householdId]
    );
    const result = await pool.query(
      "DELETE FROM food_staples WHERE id = $1 AND household_id = $2 RETURNING id",
      [stapleId, householdId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Staple not found" });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error deleting staple:", err);
    res.status(500).json({ error: "Failed to delete staple", details: message });
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
         AND chosen_for_week = active_week_start()`,
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
        `INSERT INTO food_selections (food_staple_id, household_id, status, chosen_for_week)
         VALUES ($1, $2, 'proposed', active_week_start())
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
        AND fs.chosen_for_week = active_week_start()
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
      `SELECT i.*
       FROM ingredients i
       JOIN meals m ON m.id = i.meal_id
       WHERE i.meal_id = ANY($1) AND m.household_id = $2
       ORDER BY i.optional ASC, i.name ASC`,
      [mealIds, householdId]
    );

    // Aggregate by name, converting compatible units to a common base
    // For convertible units: aggregate in base units, then pick best display unit
    // For non-convertible units (whole, cloves, pinch, to_taste): aggregate by name + unit
    const baseAggregated: Record<string, { name: string; baseQuantity: number; group: string; optional: boolean; notes: string[] }> = {};
    const directAggregated: Record<string, AggregatedIngredient> = {};

    for (const row of result.rows) {
      const multiplier = mealMultipliers[row.meal_id] || 1;
      const quantity = Number(row.quantity) * multiplier;
      const unitInfo = UNIT_TO_GROUP[row.measurement_unit];

      if (unitInfo) {
        // Convertible unit — aggregate in base units by name + group
        const key = `${row.name}::${unitInfo.group}`;
        if (!baseAggregated[key]) {
          baseAggregated[key] = { name: row.name, baseQuantity: 0, group: unitInfo.group, optional: true, notes: [] };
        }
        baseAggregated[key].baseQuantity += quantity * unitInfo.factor;
        if (!row.optional) baseAggregated[key].optional = false;
        if (row.notes && !baseAggregated[key].notes.includes(row.notes)) {
          baseAggregated[key].notes.push(row.notes);
        }
      } else {
        // Non-convertible unit — aggregate by name + unit directly
        const key = `${row.name}::${row.measurement_unit}`;
        if (!directAggregated[key]) {
          directAggregated[key] = { name: row.name, quantity: 0, measurementUnit: row.measurement_unit, optional: true, notes: [] };
        }
        directAggregated[key].quantity += quantity;
        if (!row.optional) directAggregated[key].optional = false;
        if (row.notes && !directAggregated[key].notes.includes(row.notes)) {
          directAggregated[key].notes.push(row.notes);
        }
      }
    }

    // Convert base-aggregated back to best display units
    const convertedIngredients: AggregatedIngredient[] = Object.values(baseAggregated).map((entry) => {
      const { quantity, unit } = bestDisplayUnit(entry.baseQuantity, entry.group);
      return { name: entry.name, quantity, measurementUnit: unit as AggregatedIngredient["measurementUnit"], optional: entry.optional, notes: entry.notes };
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
             fs.serving_size_multiplier,
             to_char(fs.chosen_for_week, 'YYYY-MM-DD"T"00:00:00') AS week_start
      FROM food_selections fs
      JOIN meals m ON m.id = fs.meal_id
      WHERE fs.household_id = $1
        AND fs.status != 'rejected'
      ORDER BY fs.chosen_for_week DESC, m.name ASC
    `, [householdId]);

    // Group by week
    const weeks: Record<string, { weekStart: string; meals: MealSelection[] }> = {};
    for (const row of result.rows) {
      const weekKey = row.week_start;
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
