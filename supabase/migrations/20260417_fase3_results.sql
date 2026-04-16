-- ============================================================
-- MIGRACIÓN: Fase 3 — Resultados y disputas
-- ============================================================

-- ── match_results ─────────────────────────────────────────────

-- Host del partido puede registrar el resultado
DROP POLICY IF EXISTS "host_submit_result" ON match_results;
CREATE POLICY "host_submit_result" ON match_results
  FOR INSERT WITH CHECK (
    submitted_by_user_id = auth.uid()
    AND match_id IN (
      SELECT id FROM free_matches
      WHERE created_by_user_id = auth.uid()
         OR host_user_id = auth.uid()
    )
  );

-- Cualquier usuario autenticado puede finalizar un resultado
-- pendiente cuando han pasado 24 horas sin disputa
DROP POLICY IF EXISTS "auto_final_result" ON match_results;
CREATE POLICY "auto_final_result" ON match_results
  FOR UPDATE
  USING (
    status = 'pending_confirmation'
    AND submitted_at + interval '24 hours' < now()
  )
  WITH CHECK (status = 'final');

-- Host puede marcar resultado como disputado / actualizar estado
DROP POLICY IF EXISTS "host_update_result" ON match_results;
CREATE POLICY "host_update_result" ON match_results
  FOR UPDATE
  USING (
    match_id IN (
      SELECT id FROM free_matches
      WHERE created_by_user_id = auth.uid()
         OR host_user_id = auth.uid()
    )
  );


-- ── match_result_disputes ─────────────────────────────────────

-- Participante registered_player puede abrir una disputa
DROP POLICY IF EXISTS "participant_dispute" ON match_result_disputes;
CREATE POLICY "participant_dispute" ON match_result_disputes
  FOR INSERT WITH CHECK (
    raised_by_user_id = auth.uid()
    AND match_result_id IN (
      SELECT mr.id FROM match_results mr
      JOIN match_participants mp ON mp.match_id = mr.match_id
      WHERE
        mp.participant_type = 'registered_player'
        AND (
          mp.user_id = auth.uid()
          OR mp.player_id IN (
            SELECT id FROM players WHERE profile_user_id = auth.uid()
          )
        )
    )
  );
