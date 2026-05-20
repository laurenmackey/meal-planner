ALTER TABLE households
  ADD COLUMN lookback_weeks INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN rating_weight NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  ADD COLUMN easiness_weight NUMERIC(3,2) NOT NULL DEFAULT 0.35,
  ADD COLUMN health_weight NUMERIC(3,2) NOT NULL DEFAULT 0.20,
  ADD COLUMN preferred_proteins TEXT[] NOT NULL DEFAULT '{chicken,turkey,fish}',
  ADD COLUMN default_meal_count INTEGER NOT NULL DEFAULT 3;
