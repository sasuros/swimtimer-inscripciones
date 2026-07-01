-- ============================================
-- SWIMTIMER INSCRIPCIONES - Schema Supabase
-- Ejecutar una vez en Supabase > SQL Editor.
-- ============================================

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date_start DATE NOT NULL,
  date_end DATE,
  venue TEXT DEFAULT '',
  reference_date DATE,
  deadline DATE,
  course TEXT DEFAULT 'S',
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'accepting_late', 'closed', 'archived')),
  organizer TEXT DEFAULT '',
  organizer_whatsapp TEXT DEFAULT '',
  imported_from JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE TABLE clubs (
  code INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT DEFAULT '',
  abbreviation TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  contact_whatsapp TEXT DEFAULT '',
  contact_email TEXT DEFAULT ''
);

CREATE TABLE event_clubs (
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  club_code INTEGER REFERENCES clubs(code),
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'not_participating', 'submitted', 'late_pending', 'late_approved')),
  contact_name TEXT DEFAULT '',
  contact_whatsapp TEXT DEFAULT '',
  PRIMARY KEY (event_id, club_code)
);

CREATE TABLE event_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  event_ptr INTEGER NOT NULL,
  distance INTEGER NOT NULL,
  style TEXT NOT NULL,
  age_lo INTEGER NOT NULL,
  age_hi INTEGER NOT NULL,
  sex TEXT NOT NULL DEFAULT 'F',
  active BOOLEAN DEFAULT TRUE,
  UNIQUE(event_id, event_ptr)
);

CREATE TABLE tokens (
  id TEXT PRIMARY KEY, -- SHA-256 de token_value; evita indexar URLs de varios KB
  token_value TEXT NOT NULL,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  club_code INTEGER REFERENCES clubs(code),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  UNIQUE(event_id, club_code)
);

CREATE TABLE inscriptions (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  club_code INTEGER NOT NULL REFERENCES clubs(code),
  token_id TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_late BOOLEAN DEFAULT FALSE,
  late_status TEXT DEFAULT NULL CHECK (late_status IS NULL OR late_status IN ('pending', 'partially_approved', 'approved', 'rejected')),
  athletes JSONB NOT NULL DEFAULT '[]',
  results JSONB NOT NULL DEFAULT '[]',
  roster JSONB NOT NULL DEFAULT '[]',
  meta JSONB DEFAULT '{}',
  approved_athletes JSONB NOT NULL DEFAULT '[]',
  rejected_athletes JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_event_clubs_event ON event_clubs(event_id);
CREATE INDEX idx_event_events_event ON event_events(event_id);
CREATE INDEX idx_tokens_event ON tokens(event_id);
CREATE INDEX idx_inscriptions_event ON inscriptions(event_id);
CREATE INDEX idx_inscriptions_club ON inscriptions(event_id, club_code);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fase 5: persistencia con anon key, sin Supabase Auth.
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE clubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_clubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE inscriptions DISABLE ROW LEVEL SECURITY;
