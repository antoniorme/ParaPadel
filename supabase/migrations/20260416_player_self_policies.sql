-- ============================================================
-- MIGRACIÓN: Políticas para auto-registro de jugadores y clubs
-- Permite que cualquier usuario autenticado:
--   1. Cree y actualice su propio registro en players
--   2. Cree un club donde sea el owner (flujo "Soy un club")
-- ============================================================

-- ── players ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "player_self_insert" ON players;
CREATE POLICY "player_self_insert" ON players
  FOR INSERT WITH CHECK (profile_user_id = auth.uid());

DROP POLICY IF EXISTS "player_self_update" ON players;
CREATE POLICY "player_self_update" ON players
  FOR UPDATE USING (profile_user_id = auth.uid());


-- ── club_requests ────────────────────────────────────────────
-- Solicitudes de alta como club — aprobadas por superadmin

CREATE TABLE IF NOT EXISTS club_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id  uuid REFERENCES auth.users(id),
  requested_by_email    text,
  club_name             text NOT NULL,
  address               text,
  phone                 text,
  status                text NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected
  reviewed_by           uuid REFERENCES auth.users(id),
  reviewed_at           timestamptz,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE club_requests ENABLE ROW LEVEL SECURITY;

-- El solicitante puede ver su propia solicitud
DROP POLICY IF EXISTS "view_own_request" ON club_requests;
CREATE POLICY "view_own_request" ON club_requests
  FOR SELECT USING (requested_by_user_id = auth.uid());

-- Cualquier usuario autenticado puede crear una solicitud
DROP POLICY IF EXISTS "create_club_request" ON club_requests;
CREATE POLICY "create_club_request" ON club_requests
  FOR INSERT WITH CHECK (requested_by_user_id = auth.uid());

-- Superadmin puede ver y gestionar todas las solicitudes
-- (la política de superadmin se gestiona desde el panel, usa service role)
