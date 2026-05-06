import { Router, Response } from "express";
import pool from "../db";
import { MealSelection, ChooseWeeklyMealsResponse, RejectFoodSelectionsResponse } from "../types";
import { toMeal, toFoodSelection } from "../mappers";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/v1/weeklySelections
// Returns this week's non-rejected meal selections
router.get("/weeklySelections", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  try {
    const result = await pool.query(`
      SELECT m.*, fs.id AS food_selection_id, fs.status AS selection_status
      FROM food_selections fs
      JOIN meals m ON m.id = fs.meal_id
      WHERE fs.household_id = $1
        AND fs.chosen_at > NOW() - INTERVAL '1 week'
        AND fs.status != 'rejected'
    `, [householdId]);

    const meals: MealSelection[] = result.rows.map((row) => ({
      ...toMeal(row),
      foodSelectionId: row.food_selection_id,
      selectionStatus: row.selection_status,
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

export default router;
