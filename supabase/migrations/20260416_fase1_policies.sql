-- ============================================================
-- MIGRACIÓN: Políticas Fase 1 (idempotente)
-- 1. Players pueden crear y actualizar sus propios partidos
-- 2. Guests (anon) pueden unirse como claimable_guest
-- 3. Tabla player_follows
-- ============================================================

-- ── 1. POLÍTICAS PARA free_matches ───────────────────────────

DROP POLICY IF EXISTS "player_create_match" ON free_matches;
CREATE POLICY "player_create_match" ON free_matches
  FOR INSERT WITH CHECK (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "player_update_own_match" ON free_matches;
CREATE POLICY "player_update_own_match" ON free_matches
  FOR UPDATE USING (created_by_user_id = auth.uid());


-- ── 2. POLÍTICA PARA match_participants (guests anon) ────────

DROP POLICY IF EXISTS "guest_join_match" ON match_participants;
CREATE POLICY "guest_join_match" ON match_participants
  FOR INSERT WITH CHECK (
    participant_type IN ('claimable_guest', 'placeholder_guest')
    AND user_id IS NULL
    AND player_id IS NULL
  );


-- ── 3. TABLA player_follows ───────────────────────────────────

CREATE TABLE IF NOT EXISTS player_follows (
  follower_id   uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

ALTER TABLE player_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_follows" ON player_follows;
CREATE POLICY "view_follows" ON player_follows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "manage_own_follows" ON player_follows;
CREATE POLICY "manage_own_follows" ON player_follows
  FOR ALL USING (
    follower_id IN (
      SELECT id FROM players WHERE profile_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_player_follows_follower   ON player_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_player_follows_following  ON player_follows(following_id);
