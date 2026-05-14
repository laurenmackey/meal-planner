-- Remove duplicate staple selections, keeping the oldest entry per staple per week
DELETE FROM food_selections a
USING food_selections b
WHERE a.food_staple_id IS NOT NULL
  AND a.food_staple_id = b.food_staple_id
  AND a.household_id = b.household_id
  AND DATE_TRUNC('week', a.chosen_at) = DATE_TRUNC('week', b.chosen_at)
  AND a.id > b.id;

-- Create an immutable helper for use in the unique index
CREATE OR REPLACE FUNCTION week_start_utc(ts timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT DATE_TRUNC('week', ts AT TIME ZONE 'UTC')::date;
$$;

-- Add unique index to prevent duplicate staple selections per week
CREATE UNIQUE INDEX unique_staple_per_week
  ON food_selections (food_staple_id, household_id, (week_start_utc(chosen_at)))
  WHERE food_staple_id IS NOT NULL;
