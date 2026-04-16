-- ============================================================
-- MIGRACIÓN: Fase 2 — Identidad flexible
-- 1. Host puede añadir placeholder_guest manualmente
-- 2. Usuario registrado puede reclamar una entrada claimable_guest
-- ============================================================

-- ── Reclamación de invitado ───────────────────────────────────
-- Un usuario autenticado puede reclamar una entrada claimable_guest
-- no reclamada. La fila pasa a linked_user_id = auth.uid().

DROP POLICY IF EXISTS "claim_guest_entry" ON match_participants;
CREATE POLICY "claim_guest_entry" ON match_participants
  FOR UPDATE
  USING (
    participant_type = 'claimable_guest'
    AND claimed_user_id IS NULL
  )
  WITH CHECK (
    claimed_user_id = auth.uid()
  );

-- ── Host puede eliminar participantes de su partido ───────────
-- (necesario para que el host pueda gestionar la lista)

DROP POLICY IF EXISTS "host_manage_participants" ON match_participants;
CREATE POLICY "host_manage_participants" ON match_participants
  FOR ALL USING (
    match_id IN (
      SELECT id FROM free_matches
      WHERE created_by_user_id = auth.uid()
         OR host_user_id = auth.uid()
    )
  );
