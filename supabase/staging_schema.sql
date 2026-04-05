-- ============================================================
-- ParaPádel — Schema completo para Staging
-- Aplicar en: app.supabase.com → proyecto staging → SQL Editor
-- ============================================================

-- Extensión UUID (ya viene activada en Supabase, pero por si acaso)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. SUPERADMINS
-- ============================================================
CREATE TABLE IF NOT EXISTS superadmins (
    id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email   TEXT NOT NULL UNIQUE
);

ALTER TABLE superadmins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins pueden verse a sí mismos"
    ON superadmins FOR SELECT
    USING (auth.jwt() ->> 'email' = email);


-- ============================================================
-- 2. CLUBS
-- ============================================================
CREATE TABLE IF NOT EXISTS clubs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    court_count         INT  DEFAULT 4,
    address             TEXT,
    maps_url            TEXT,
    phone               TEXT,
    logo_url            TEXT,
    league_enabled      BOOLEAN DEFAULT FALSE,
    minis_lite_enabled  BOOLEAN DEFAULT FALSE,
    minis_full_enabled  BOOLEAN DEFAULT TRUE,
    show_players        BOOLEAN DEFAULT TRUE,
    show_history        BOOLEAN DEFAULT TRUE,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin ve su propio club"
    ON clubs FOR ALL
    USING (owner_id = auth.uid());

CREATE POLICY "Clubs activos son visibles públicamente"
    ON clubs FOR SELECT
    USING (is_active = TRUE);


-- ============================================================
-- 3. PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- Club owner
    profile_user_id     UUID REFERENCES auth.users(id),                    -- Jugador registrado
    name                TEXT NOT NULL,
    nickname            TEXT,
    email               TEXT,
    phone               TEXT,
    categories          TEXT[],
    preferred_position  TEXT CHECK (preferred_position IN ('right', 'backhand')),
    play_both_sides     BOOLEAN DEFAULT FALSE,
    global_rating       NUMERIC DEFAULT 1200,
    category_ratings    JSONB,
    main_category       TEXT,
    matches_played      INT  DEFAULT 0,
    manual_rating       NUMERIC,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club ve sus propios jugadores"
    ON players FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Jugador ve su propio perfil"
    ON players FOR SELECT
    USING (profile_user_id = auth.uid());


-- ============================================================
-- 4. TOURNAMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tournaments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'setup'
                            CHECK (status IN ('setup', 'checkin', 'active', 'finished')),
    current_round       INT  DEFAULT 0,
    format              TEXT NOT NULL DEFAULT '16_mini'
                            CHECK (format IN ('8_mini', '10_mini', '12_mini', '16_mini')),
    title               TEXT,
    description         TEXT,
    price               NUMERIC DEFAULT 0,
    level_range         TEXT,
    prizes              TEXT[],
    included_items      TEXT[],
    date                TIMESTAMPTZ DEFAULT NOW(),
    winner_main         TEXT,
    winner_consolation  TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestiona sus torneos"
    ON tournaments FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Torneos activos visibles públicamente"
    ON tournaments FOR SELECT
    USING (status IN ('setup', 'active'));


-- ============================================================
-- 5. TOURNAMENT_PAIRS
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_pairs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id   UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    player1_id      UUID REFERENCES players(id),
    player2_id      UUID REFERENCES players(id),
    status          TEXT DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed', 'pending', 'rejected')),
    water_received  BOOLEAN DEFAULT FALSE,
    paid_p1         BOOLEAN DEFAULT FALSE,
    paid_p2         BOOLEAN DEFAULT FALSE,
    group_id        TEXT,
    is_reserve      BOOLEAN DEFAULT FALSE,
    stats           JSONB DEFAULT '{"played": 0, "won": 0, "gameDiff": 0}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournament_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestiona las parejas de su torneo"
    ON tournament_pairs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_pairs.tournament_id
              AND t.user_id = auth.uid()
        )
    );

CREATE POLICY "Jugador ve parejas de torneos públicos"
    ON tournament_pairs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = tournament_pairs.tournament_id
              AND t.status IN ('setup', 'active')
        )
    );


-- ============================================================
-- 6. MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id   UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    round           INT  NOT NULL DEFAULT 1,
    phase           TEXT DEFAULT 'group'
                        CHECK (phase IN ('group', 'qf', 'sf', 'final')),
    bracket         TEXT CHECK (bracket IN ('main', 'consolation')),
    court_id        INT  DEFAULT 1,
    pair_a_id       UUID REFERENCES tournament_pairs(id),
    pair_b_id       UUID REFERENCES tournament_pairs(id),
    score_a         INT,
    score_b         INT,
    is_finished     BOOLEAN DEFAULT FALSE,
    elo_processed   BOOLEAN DEFAULT FALSE
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestiona partidos de su torneo"
    ON matches FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = matches.tournament_id
              AND t.user_id = auth.uid()
        )
    );

CREATE POLICY "Partidos de torneos activos visibles públicamente"
    ON matches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tournaments t
            WHERE t.id = matches.tournament_id
              AND t.status = 'active'
        )
    );


-- ============================================================
-- 7. LEAGUES
-- ============================================================
CREATE TABLE IF NOT EXISTS leagues (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    status              TEXT DEFAULT 'registration'
                            CHECK (status IN ('registration', 'groups', 'playoffs', 'finished')),
    start_date          TEXT,
    end_date            TEXT,
    playoff_date        TEXT,
    is_module_active    BOOLEAN DEFAULT TRUE,
    config              JSONB DEFAULT '{"double_round": false}'::jsonb,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestiona su liga"
    ON leagues FOR ALL
    USING (club_id = auth.uid());


-- ============================================================
-- 8. LEAGUE_CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS league_categories (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id       UUID REFERENCES leagues(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    prize_winner    TEXT DEFAULT '',
    prize_runnerup  TEXT DEFAULT '',
    pairs_count     INT  DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE league_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestiona categorías de su liga"
    ON league_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM leagues l
            WHERE l.id = league_categories.league_id
              AND l.club_id = auth.uid()
        )
    );


-- ============================================================
-- 9. LEAGUE_GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS league_groups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id       UUID REFERENCES leagues(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES league_categories(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    pair_ids        TEXT[] DEFAULT '{}'
);

ALTER TABLE league_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestiona grupos de su liga"
    ON league_groups FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM leagues l
            WHERE l.id = league_groups.league_id
              AND l.club_id = auth.uid()
        )
    );


-- ============================================================
-- 10. LEAGUE_PAIRS
-- ============================================================
CREATE TABLE IF NOT EXISTS league_pairs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id       UUID REFERENCES leagues(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES league_categories(id),
    player1_id      UUID REFERENCES players(id),
    player2_id      UUID REFERENCES players(id),
    name            TEXT DEFAULT 'Pareja',
    group_id        UUID REFERENCES league_groups(id),
    stats           JSONB DEFAULT '{"played": 0, "won": 0, "gameDiff": 0}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE league_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestiona parejas de su liga"
    ON league_pairs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM leagues l
            WHERE l.id = league_pairs.league_id
              AND l.club_id = auth.uid()
        )
    );


-- ============================================================
-- 11. LEAGUE_MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS league_matches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id       UUID REFERENCES leagues(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES league_categories(id),
    group_id        UUID REFERENCES league_groups(id),
    phase           TEXT DEFAULT 'group'
                        CHECK (phase IN ('group', 'playoff')),
    round           INT,
    pair_a_id       UUID REFERENCES league_pairs(id),
    pair_b_id       UUID REFERENCES league_pairs(id),
    sets_a          INT,
    sets_b          INT,
    score_text      TEXT,
    is_finished     BOOLEAN DEFAULT FALSE,
    date_scheduled  TEXT,
    winner_id       UUID REFERENCES league_pairs(id)
);

ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestiona partidos de su liga"
    ON league_matches FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM leagues l
            WHERE l.id = league_matches.league_id
              AND l.club_id = auth.uid()
        )
    );


-- ============================================================
-- 12. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL
                    CHECK (type IN ('invite', 'match_start', 'result', 'system', 'alert')),
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    link        TEXT,
    read        BOOLEAN DEFAULT FALSE,
    meta        JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve sus propias notificaciones"
    ON notifications FOR ALL
    USING (user_id = auth.uid());


-- ============================================================
-- FIN — Schema aplicado correctamente
-- ============================================================
