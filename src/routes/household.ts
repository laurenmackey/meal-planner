import { Router, Response } from "express";
import pool from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { HouseholdSettings } from "../types";

const router = Router();

function toSettings(row: any): HouseholdSettings {
  return {
    lookbackWeeks: row.lookback_weeks,
    ratingWeight: Number(row.rating_weight),
    easinessWeight: Number(row.easiness_weight),
    healthWeight: Number(row.health_weight),
    preferredProteins: row.preferred_proteins,
    defaultMealCount: row.default_meal_count,
  };
}

// GET /api/v1/household/settings
router.get("/household/settings", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  try {
    const result = await pool.query(
      `SELECT name, invite_code, lookback_weeks, rating_weight, easiness_weight, health_weight,
              preferred_proteins, default_meal_count
       FROM households WHERE id = $1`,
      [householdId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Household not found" });
      return;
    }
    const row = result.rows[0];
    res.json({
      name: row.name,
      inviteCode: row.invite_code,
      settings: toSettings(row),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching household settings:", err);
    res.status(500).json({ error: "Failed to fetch settings", details: message });
  }
});

// PUT /api/v1/household/settings
router.put("/household/settings", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const { name, lookbackWeeks, ratingWeight, easinessWeight, healthWeight, preferredProteins, defaultMealCount } = req.body as HouseholdSettings & { name?: string };

  try {
    const result = await pool.query(
      `UPDATE households SET
        name = COALESCE($1, name),
        lookback_weeks = $2,
        rating_weight = $3,
        easiness_weight = $4,
        health_weight = $5,
        preferred_proteins = $6,
        default_meal_count = $7,
        updated_at = NOW()
      WHERE id = $8
      RETURNING name, lookback_weeks, rating_weight, easiness_weight, health_weight,
                preferred_proteins, default_meal_count`,
      [name, lookbackWeeks, ratingWeight, easinessWeight, healthWeight, preferredProteins, defaultMealCount, householdId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Household not found" });
      return;
    }

    res.json({ name: result.rows[0].name, settings: toSettings(result.rows[0]) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error updating household settings:", err);
    res.status(500).json({ error: "Failed to update settings", details: message });
  }
});

export default router;
