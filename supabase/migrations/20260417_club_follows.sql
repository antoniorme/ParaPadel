-- ============================================================
-- MIGRACIÓN: Seguir clubs + notificaciones de nuevos partidos
-- ============================================================

-- ── 1. Tabla player_club_follows ──────────────────────────────

CREATE TABLE IF NOT EXISTS player_club_follows (
  player_id          uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  club_id            uuid NOT NULL REFERENCES clubs(id)   ON DELETE CASCADE,
  notify_new_matches boolean NOT NULL DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  PRIMARY KEY (player_id, club_id)
);

ALTER TABLE player_club_follows ENABLE ROW LEVEL SECURITY;

-- El jugador puede ver y gestionar sus propios follows
DROP POLICY IF EXISTS "player_manage_follows" ON player_club_follows;
CREATE POLICY "player_manage_follows" ON player_club_follows
  FOR ALL USING (
    player_id IN (
      SELECT id FROM players WHERE profile_user_id = auth.uid()
    )
  );

-- Índice para buscar seguidores de un club rápido
CREATE INDEX IF NOT EXISTS idx_club_follows_club_id ON player_club_follows(club_id);


-- ── 2. Trigger: notificar seguidores al crear partido libre ───

CREATE OR REPLACE FUNCTION fn_notify_club_followers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_follower RECORD;
  v_club_name text;
  v_time text;
BEGIN
  -- Solo partidos nuevos con estado 'open'
  IF TG_OP <> 'INSERT' OR NEW.status <> 'open' OR NEW.club_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_club_name FROM clubs WHERE id = NEW.club_id;
  IF v_club_name IS NULL THEN RETURN NEW; END IF;

  v_time := to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI');

  FOR v_follower IN
    SELECT pcf.player_id, p.profile_user_id
    FROM player_club_follows pcf
    JOIN players p ON p.id = pcf.player_id
    WHERE pcf.club_id = NEW.club_id
      AND pcf.notify_new_matches = true
      AND p.profile_user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (user_id, type, title, message, link, read)
    VALUES (
      v_follower.profile_user_id,
      'system',
      v_club_name || ' ha abierto un partido',
      'Partido el ' || v_time || ' — ' || COALESCE(NEW.level, 'nivel abierto') || '. ¡Únete ahora!',
      '/m/' || NEW.share_token,
      false
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_club_followers ON free_matches;
CREATE TRIGGER tr_notify_club_followers
  AFTER INSERT ON free_matches
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_club_followers();
