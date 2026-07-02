-- PIN de acceso para invitaciones por correo (tokens v3).
ALTER TABLE event_clubs ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '';
