-- ============================================================
-- MIGRACIÓN: Fase 4 — Club Rating + Confidence
-- ============================================================

-- ── 1. Columnas en players ────────────────────────────────────

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS club_rating     int  DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS club_confidence int  DEFAULT 0;


-- ── 2. Trigger: aplicar ELO cuando resultado → 'final' ────────

CREATE OR REPLACE FUNCTION fn_apply_club_ratings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total        int;
  v_placeholders int;
  v_unverified   int;
  v_trust        text;
  v_k            int;
  v_winner_team  text;
  v_participant  RECORD;
  v_my_rating    int;
  v_opp_avg      int;
  v_expected     float;
  v_actual       float;
  v_delta        int;
BEGIN
  -- Solo cuando pasa A 'final' desde otro estado
  IF NEW.status <> 'final' OR OLD.status = 'final' THEN
    RETURN NEW;
  END IF;

  -- Evitar doble procesado
  IF EXISTS (SELECT 1 FROM free_matches WHERE id = NEW.match_id AND elo_processed = true) THEN
    RETURN NEW;
  END IF;

  -- ── Trust score ────────────────────────────────────────────
  SELECT
    COUNT(*)                                                              AS total,
    COUNT(*) FILTER (WHERE participant_type = 'placeholder_guest')       AS placeholders,
    COUNT(*) FILTER (
      WHERE participant_type = 'claimable_guest' AND claimed_user_id IS NULL
    )                                                                     AS unverified
  INTO v_total, v_placeholders, v_unverified
  FROM match_participants
  WHERE match_id = NEW.match_id
    AND attendance_status IN ('joined', 'confirmed');

  IF v_total = 0 THEN
    UPDATE free_matches SET elo_processed = true WHERE id = NEW.match_id;
    RETURN NEW;
  END IF;

  IF v_placeholders > v_total / 2 THEN
    v_trust := 'none';
  ELSIF v_unverified > 0 THEN
    v_trust := 'partial';
  ELSE
    v_trust := 'full';
  END IF;

  -- trust = none → no ELO, pero marcar procesado
  IF v_trust = 'none' THEN
    UPDATE free_matches SET elo_processed = true WHERE id = NEW.match_id;
    RETURN NEW;
  END IF;

  -- Verificar que hay equipos asignados
  IF NOT EXISTS (
    SELECT 1 FROM match_participants
    WHERE match_id = NEW.match_id
      AND team IN ('A', 'B')
      AND attendance_status IN ('joined', 'confirmed')
      AND participant_type = 'registered_player'
      AND player_id IS NOT NULL
  ) THEN
    UPDATE free_matches SET elo_processed = true WHERE id = NEW.match_id;
    RETURN NEW;
  END IF;

  -- K-factor según calidad del partido
  v_k := CASE v_trust WHEN 'full' THEN 20 ELSE 10 END;

  -- Ganador
  IF NEW.team_a_score > NEW.team_b_score    THEN v_winner_team := 'A';
  ELSIF NEW.team_b_score > NEW.team_a_score THEN v_winner_team := 'B';
  ELSE v_winner_team := NULL; -- empate
  END IF;

  -- ── Calcular y aplicar ELO ────────────────────────────────
  FOR v_participant IN
    SELECT mp.id, mp.player_id, mp.team,
           COALESCE(p.club_rating, 1200) AS rating
    FROM match_participants mp
    JOIN players p ON p.id = mp.player_id
    WHERE mp.match_id = NEW.match_id
      AND mp.attendance_status IN ('joined', 'confirmed')
      AND mp.participant_type = 'registered_player'
      AND mp.team IN ('A', 'B')
      AND mp.player_id IS NOT NULL
  LOOP
    -- Rating medio del equipo contrario
    SELECT COALESCE(AVG(COALESCE(p2.club_rating, 1200)), 1200)::int
    INTO v_opp_avg
    FROM match_participants mp2
    JOIN players p2 ON p2.id = mp2.player_id
    WHERE mp2.match_id = NEW.match_id
      AND mp2.attendance_status IN ('joined', 'confirmed')
      AND mp2.participant_type = 'registered_player'
      AND mp2.team <> v_participant.team
      AND mp2.player_id IS NOT NULL;

    v_my_rating := v_participant.rating;
    v_expected  := 1.0 / (1.0 + power(10.0, (v_opp_avg - v_my_rating)::float / 400.0));

    v_actual := CASE
      WHEN v_winner_team IS NULL          THEN 0.5
      WHEN v_participant.team = v_winner_team THEN 1.0
      ELSE 0.0
    END;

    v_delta := ROUND(v_k * (v_actual - v_expected));

    UPDATE players SET
      club_rating     = GREATEST(100, COALESCE(club_rating, 1200) + v_delta),
      club_confidence = COALESCE(club_confidence, 0) + 1
    WHERE id = v_participant.player_id;
  END LOOP;

  UPDATE free_matches SET elo_processed = true WHERE id = NEW.match_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_apply_club_ratings ON match_results;
CREATE TRIGGER tr_apply_club_ratings
  AFTER UPDATE ON match_results
  FOR EACH ROW
  EXECUTE FUNCTION fn_apply_club_ratings();


-- ── 3. Índice para ranking por club_rating ────────────────────
CREATE INDEX IF NOT EXISTS idx_players_club_rating ON players(club_rating DESC);
