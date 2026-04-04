-- Add visibility columns to clubs table
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS show_players BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_history BOOLEAN DEFAULT TRUE;

-- Update existing rows
UPDATE clubs SET show_players = TRUE WHERE show_players IS NULL;
UPDATE clubs SET show_history = TRUE WHERE show_history IS NULL;
