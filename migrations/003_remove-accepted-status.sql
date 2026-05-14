-- Remove 'accepted' from food_selections status check constraint
-- First update any existing 'accepted' rows back to 'proposed'
UPDATE food_selections SET status = 'proposed' WHERE status = 'accepted';

ALTER TABLE food_selections
  DROP CONSTRAINT food_selections_status_check,
  ADD CONSTRAINT food_selections_status_check CHECK (status IN ('proposed', 'rejected'));
