import { Router, Response } from "express";
import { ChooseWeeklyMealsResponse } from "../types";
import { authenticate, AuthRequest } from "../middleware/auth";
import { chooseWeeklyMeals, DEFAULT_MEAL_COUNT } from "../services/mealSelection";
import { runWeeklyMealJob } from "../cron/weeklyMeals";

const router = Router();

// POST /api/v1/chooseWeeklyMeals
// Body: { count?: number, includeAll?: boolean }
router.post("/chooseWeeklyMeals", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const count = req.body.count ?? DEFAULT_MEAL_COUNT;
  const includeAll = req.body.includeAll ?? false;

  try {
    const meals = await chooseWeeklyMeals(householdId, count, includeAll);
    const response: ChooseWeeklyMealsResponse = { meals };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error choosing weekly meals:", err);
    res.status(500).json({ error: "Failed to choose weekly meals", details: message });
  }
});

// POST /api/v1/testWeeklyEmail
// Manually trigger the weekly meal email for testing
router.post("/testWeeklyEmail", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    await runWeeklyMealJob();
    res.json({ message: "Weekly email job triggered" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to run weekly email job", details: message });
  }
});

export default router;
