-- Add columns for module control in clubs table
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS minis_lite_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS minis_full_enabled BOOLEAN DEFAULT TRUE;

-- Update existing rows to have defaults if needed (though DEFAULT handles new rows)
UPDATE clubs SET minis_full_enabled = TRUE WHERE minis_full_enabled IS NULL;
UPDATE clubs SET minis_lite_enabled = FALSE WHERE minis_lite_enabled IS NULL;
