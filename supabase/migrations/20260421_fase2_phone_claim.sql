-- Fase 2: Auto-claim de invitado reclamable cuando el jugador se registra
-- con el mismo número de teléfono guardado en match_participants.guest_phone
--
-- Trigger: cuando se inserta o actualiza un player con phone,
-- busca match_participants de tipo claimable_guest con ese phone
-- y migra el historial al nuevo player.

CREATE OR REPLACE FUNCTION claim_guest_by_phone()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Solo actúa si el player tiene teléfono y tiene profile_user_id vinculado
  IF NEW.phone IS NULL OR NEW.profile_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE match_participants
  SET
    claimed_user_id    = NEW.profile_user_id,
    user_id            = NEW.profile_user_id,
    player_id          = NEW.id,
    participant_type   = 'registered_player',
    is_rating_eligible = true
  WHERE
    participant_type = 'claimable_guest'
    AND claimed_user_id IS NULL
    AND guest_phone = NEW.phone;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_claim_guest_by_phone ON players;

CREATE TRIGGER trg_claim_guest_by_phone
AFTER INSERT OR UPDATE OF phone ON players
FOR EACH ROW
EXECUTE FUNCTION claim_guest_by_phone();
