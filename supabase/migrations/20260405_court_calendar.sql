-- ═══════════════════════════════════════════════════════════════
-- CALENDARIO DE PISTAS — ParaPádel
-- ═══════════════════════════════════════════════════════════════

-- Configuración de pistas por club
CREATE TABLE IF NOT EXISTS court_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  court_number INT NOT NULL,
  court_name TEXT NOT NULL DEFAULT 'Pista',
  slot_minutes INT NOT NULL DEFAULT 90 CHECK (slot_minutes IN (60, 90)),
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '22:00',
  active_days INT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, court_number)
);

-- Bloqueos puntuales (torneos, mantenimiento, privado)
CREATE TABLE IF NOT EXISTS court_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  court_number INT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL DEFAULT 'Bloqueado',
  block_type TEXT NOT NULL DEFAULT 'manual' CHECK (block_type IN ('manual', 'tournament', 'maintenance', 'private')),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservas de pistas
CREATE TABLE IF NOT EXISTS court_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  court_number INT NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  player_name TEXT,
  player_phone TEXT,
  player_email TEXT,
  partner_name TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'whatsapp', 'admin', 'join_link')),
  notes TEXT,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_court_reservations_club_date ON court_reservations(club_id, start_at);
CREATE INDEX IF NOT EXISTS idx_court_blocks_club_date ON court_blocks(club_id, start_at);

-- RLS
ALTER TABLE court_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_reservations ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer disponibilidad (para mostrar slots libres a jugadores)
CREATE POLICY "court_availability_read" ON court_availability FOR SELECT USING (TRUE);
CREATE POLICY "court_availability_write" ON court_availability FOR ALL
  USING (club_id IN (SELECT id FROM clubs WHERE owner_id = auth.uid()));

CREATE POLICY "court_blocks_read" ON court_blocks FOR SELECT USING (TRUE);
CREATE POLICY "court_blocks_write" ON court_blocks FOR ALL
  USING (club_id IN (SELECT id FROM clubs WHERE owner_id = auth.uid()));

-- Admin gestiona todas las reservas de su club
CREATE POLICY "court_reservations_admin" ON court_reservations FOR ALL
  USING (club_id IN (SELECT id FROM clubs WHERE owner_id = auth.uid()));

-- Jugador puede ver y crear sus propias reservas
CREATE POLICY "court_reservations_player_read" ON court_reservations FOR SELECT
  USING (player_id IN (SELECT id FROM players WHERE profile_user_id = auth.uid()));

CREATE POLICY "court_reservations_player_insert" ON court_reservations FOR INSERT
  WITH CHECK (TRUE); -- Cualquiera puede solicitar, admin confirma
