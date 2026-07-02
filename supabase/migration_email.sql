-- Migración: correo por club, estado de invitación y tokens v3.
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE event_clubs ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE event_clubs ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ;
ALTER TABLE event_clubs ADD COLUMN IF NOT EXISTS invitation_error TEXT DEFAULT '';
ALTER TABLE event_clubs ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '';
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS token_type TEXT NOT NULL DEFAULT 'v2';
ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_event_id_club_code_key;
ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_event_id_club_code_token_type_key;
ALTER TABLE tokens ADD CONSTRAINT tokens_event_id_club_code_token_type_key UNIQUE(event_id, club_code, token_type);
