import pool from "../db";
import { StapleSelection } from "../types";

export async function chooseWeeklyStaples(householdId: number, restore = false): Promise<StapleSelection[]> {
  const staples = await pool.query(
    "SELECT id FROM food_staples WHERE household_id = $1",
    [householdId]
  );

  // Insert all staples, allowing the unique index to reject any duplicates for the week
  for (const staple of staples.rows) {
    await pool.query(
      `INSERT INTO food_selections (food_staple_id, household_id, status, chosen_for_week)
       VALUES ($1, $2, 'proposed', active_week_start())
       ON CONFLICT DO NOTHING`,
      [staple.id, householdId]
    );
  }

  // Re-propose any rejected staples when restoring
  if (restore) {
    await pool.query(
      `UPDATE food_selections
       SET status = 'proposed', updated_at = NOW()
       WHERE household_id = $1
         AND food_staple_id IS NOT NULL
         AND chosen_for_week = active_week_start()
         AND status = 'rejected'`,
      [householdId]
    );
  }

  // Return all non-rejected staple selections for this week
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

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    notes: row.notes,
    foodSelectionId: row.food_selection_id,
    selectionStatus: row.selection_status,
  }));
}
