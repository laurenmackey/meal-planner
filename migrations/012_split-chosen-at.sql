-- Split the overloaded `chosen_at` column into two clear columns:
--   * created_at      — the real wall-clock time the row was created (audit only)
--   * chosen_for_week — the Monday (date) of the week the selection applies to
-- Week membership is now an explicit stored date rather than something derived from
-- a timestamp, so a selection's week no longer depends on when it happened to be created.

ALTER TABLE food_selections ADD COLUMN created_at TIMESTAMPTZ;
ALTER TABLE food_selections ADD COLUMN chosen_for_week DATE;

-- Backfill from the existing chosen_at:
--   created_at      ~ when the row was created (chosen_at is the best available proxy)
--   chosen_for_week = the Mon–Sun week chosen_at fell into
UPDATE food_selections
SET created_at = chosen_at,
    chosen_for_week = week_start_utc(chosen_at);

ALTER TABLE food_selections ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE food_selections ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE food_selections ALTER COLUMN chosen_for_week SET NOT NULL;

-- Move indexes off chosen_at
DROP INDEX IF EXISTS unique_staple_per_week;
CREATE UNIQUE INDEX unique_staple_per_week
  ON food_selections (food_staple_id, household_id, chosen_for_week)
  WHERE food_staple_id IS NOT NULL;

DROP INDEX IF EXISTS idx_food_selections_chosen_at;
CREATE INDEX idx_food_selections_chosen_for_week ON food_selections(chosen_for_week);

-- Drop the old column and the helper that anchored a timestamp to the active week
-- (inserts now set chosen_for_week = active_week_start() directly).
ALTER TABLE food_selections DROP COLUMN chosen_at;
DROP FUNCTION IF EXISTS active_week_chosen_at();
