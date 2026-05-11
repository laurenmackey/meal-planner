-- Migration: Add 'lamb' to main_protein check constraint

ALTER TABLE meals DROP CONSTRAINT meals_main_protein_check;
ALTER TABLE meals ADD CONSTRAINT meals_main_protein_check
    CHECK (main_protein IN ('chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'shrimp', 'prawns', 'crab', 'tofu', 'none', 'other'));
