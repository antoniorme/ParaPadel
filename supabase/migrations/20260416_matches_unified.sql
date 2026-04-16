-- ============================================================
-- MIGRACIÓN: tabla unificada matches + match_participants
-- Reemplaza la tabla partidos (se migran datos y se elimina)
-- Ejecutar en orden. Rollback no incluido.
-- ============================================================

-- ── 1. TABLA MATCHES ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid REFERENCES clubs(id) ON DELETE CASCADE,
  created_by_user_id    uuid REFERENCES auth.users(id),
  host_user_id          uuid REFERENCES auth.users(id),
  title                 text,
  sport                 text NOT NULL DEFAULT 'padel',
  format                text NOT NULL DEFAULT '2v2',
  scheduled_at          timestamptz NOT NULL,
  duration_minutes      int DEFAULT 90,
  court                 text,
  max_players           int NOT NULL DEFAULT 4,
  status                text NOT NULL DEFAULT 'open',
    -- draft | open | full | in_progress | finished | cancelled
  visibility            text NOT NULL DEFAULT 'link_only',
  share_token           text UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  result_status         text NOT NULL DEFAULT 'not_submitted',
    -- not_submitted | pending_confirmation | disputed | final
  slots_are_equivalent  boolean NOT NULL DEFAULT true,
  level                 text,
  notes                 text,
  elo_processed         boolean NOT NULL DEFAULT false,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Admin del club puede todo
CREATE POLICY "admin_matches" ON matches
  FOR ALL USING (
    club_id = (SELECT id FROM clubs WHERE owner_id = auth.uid())
  );

-- Jugador del club puede ver
CREATE POLICY "player_view_matches" ON matches
  FOR SELECT USING (
    club_id IN (
      SELECT user_id FROM players WHERE profile_user_id = auth.uid()
    )
  );

-- Acceso público por share_token (para la ficha pública del partido)
CREATE POLICY "public_match_by_token" ON matches
  FOR SELECT USING (true);


-- ── 2. TABLA MATCH_PARTICIPANTS ───────────────────────────────

CREATE TABLE IF NOT EXISTS match_participants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  participant_type    text NOT NULL DEFAULT 'registered_player',
    -- registered_player | claimable_guest | placeholder_guest
  user_id             uuid REFERENCES auth.users(id),
  player_id           uuid REFERENCES players(id) ON DELETE SET NULL,
  guest_name          text,
  guest_phone         text,
  slot_index          int,
  team                text,    -- A | B | null
  joined_via          text NOT NULL DEFAULT 'manual',
    -- link | manual | invite
  attendance_status   text NOT NULL DEFAULT 'joined',
    -- joined | confirmed | declined | cancelled | removed | no_show
  claimed_user_id     uuid REFERENCES auth.users(id),
  is_rating_eligible  boolean NOT NULL DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver participantes (necesario para ficha pública)
CREATE POLICY "view_participants" ON match_participants
  FOR SELECT USING (true);

-- Admin del club puede gestionar todos los participantes
CREATE POLICY "admin_manage_participants" ON match_participants
  FOR ALL USING (
    match_id IN (
      SELECT id FROM matches
      WHERE club_id = (SELECT id FROM clubs WHERE owner_id = auth.uid())
    )
  );

-- Jugador puede gestionar su propia participación
CREATE POLICY "player_self_manage" ON match_participants
  FOR ALL USING (
    player_id IN (
      SELECT id FROM players WHERE profile_user_id = auth.uid()
    )
  );


-- ── 3. TABLA MATCH_RESULTS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS match_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id              uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  submitted_by_user_id  uuid REFERENCES auth.users(id),
  team_a_score          int NOT NULL,
  team_b_score          int NOT NULL,
  submitted_at          timestamptz DEFAULT now(),
  status                text NOT NULL DEFAULT 'pending_confirmation',
    -- pending_confirmation | disputed | final
  rating_impact_mode    text NOT NULL DEFAULT 'full'
    -- full | partial | none
);

ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_results" ON match_results
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_results" ON match_results
  FOR ALL USING (
    match_id IN (
      SELECT id FROM matches
      WHERE club_id = (SELECT id FROM clubs WHERE owner_id = auth.uid())
    )
  );


-- ── 4. TABLA MATCH_RESULT_DISPUTES ───────────────────────────

CREATE TABLE IF NOT EXISTS match_result_disputes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_result_id       uuid NOT NULL REFERENCES match_results(id) ON DELETE CASCADE,
  raised_by_user_id     uuid REFERENCES auth.users(id),
  reason                text,
  status                text NOT NULL DEFAULT 'open',
    -- open | resolved
  resolved_by_user_id   uuid REFERENCES auth.users(id),
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE match_result_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_disputes" ON match_result_disputes
  FOR SELECT USING (true);

CREATE POLICY "raise_dispute" ON match_result_disputes
  FOR INSERT WITH CHECK (raised_by_user_id = auth.uid());

CREATE POLICY "admin_resolve_dispute" ON match_result_disputes
  FOR UPDATE USING (
    match_result_id IN (
      SELECT mr.id FROM match_results mr
      JOIN matches m ON mr.match_id = m.id
      WHERE m.club_id = (SELECT id FROM clubs WHERE owner_id = auth.uid())
    )
  );


-- ── 5. MIGRAR DATOS DE PARTIDOS → MATCHES ────────────────────
-- Solo ejecutar si la tabla partidos existe con datos.
-- Comprobar antes: SELECT count(*) FROM partidos;

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'partidos'
  ) THEN

    -- 5a. Migrar cabecera del partido
    INSERT INTO matches (
      id, club_id,
      scheduled_at,
      court,
      max_players,
      status,
      result_status,
      elo_processed,
      notes,
      created_at
    )
    SELECT
      id,
      club_id,
      (date::text || ' ' || COALESCE(start_time::text, '00:00:00'))::timestamptz AS scheduled_at,
      court,
      4,
      CASE WHEN is_finished THEN 'finished' ELSE 'open' END,
      CASE WHEN is_finished THEN 'final' ELSE 'not_submitted' END,
      elo_processed,
      notes,
      created_at
    FROM partidos
    ON CONFLICT (id) DO NOTHING;

    -- 5b. Migrar participantes (4 columnas fijas → filas)
    INSERT INTO match_participants (match_id, player_id, slot_index, team, participant_type, joined_via)
    SELECT id, player1_a, 1, 'A', 'registered_player', 'manual'
    FROM partidos WHERE player1_a IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO match_participants (match_id, player_id, slot_index, team, participant_type, joined_via)
    SELECT id, player2_a, 2, 'A', 'registered_player', 'manual'
    FROM partidos WHERE player2_a IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO match_participants (match_id, player_id, slot_index, team, participant_type, joined_via)
    SELECT id, player1_b, 3, 'B', 'registered_player', 'manual'
    FROM partidos WHERE player1_b IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO match_participants (match_id, player_id, slot_index, team, participant_type, joined_via)
    SELECT id, player2_b, 4, 'B', 'registered_player', 'manual'
    FROM partidos WHERE player2_b IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 5c. Migrar resultados
    INSERT INTO match_results (match_id, team_a_score, team_b_score, status, rating_impact_mode)
    SELECT id, score_a, score_b, 'final', 'full'
    FROM partidos
    WHERE is_finished = true
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Migración de partidos completada.';

  ELSE
    RAISE NOTICE 'Tabla partidos no encontrada, migración de datos omitida.';
  END IF;
END $$;


-- ── 6. ELIMINAR TABLA PARTIDOS ────────────────────────────────
-- Solo ejecutar DESPUÉS de verificar que los datos se migraron bien.
-- Comprobar: SELECT count(*) FROM matches; SELECT count(*) FROM match_participants;
-- DROP TABLE IF EXISTS partidos CASCADE;
-- (comentado intencionalmente — ejecutar manualmente tras verificar)


-- ── 7. ÍNDICES DE RENDIMIENTO ─────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_matches_club_id ON matches(club_id);
CREATE INDEX IF NOT EXISTS idx_matches_share_token ON matches(share_token);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_match_participants_match_id ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_player_id ON match_participants(player_id);
CREATE INDEX IF NOT EXISTS idx_match_results_match_id ON match_results(match_id);
