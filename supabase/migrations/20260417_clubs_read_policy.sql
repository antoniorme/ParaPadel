-- Permitir a cualquier usuario autenticado leer la lista de clubs
-- (necesario para ClubMatchBrowser y ClubMatchesPage)

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_clubs" ON clubs;
CREATE POLICY "authenticated_read_clubs" ON clubs
  FOR SELECT
  TO authenticated
  USING (true);

-- También permitir lectura pública (para /club/:id/partidos sin auth)
DROP POLICY IF EXISTS "public_read_clubs" ON clubs;
CREATE POLICY "public_read_clubs" ON clubs
  FOR SELECT
  TO anon
  USING (true);
