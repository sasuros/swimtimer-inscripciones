-- Convierte el indicador booleano de la landing en un estado público explícito.
ALTER TABLE events ALTER COLUMN is_live DROP DEFAULT;
ALTER TABLE events ALTER COLUMN is_live TYPE TEXT
USING CASE WHEN is_live = true THEN 'live' ELSE 'finished' END;
ALTER TABLE events ALTER COLUMN is_live SET DEFAULT 'upcoming';

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_is_live_check;
ALTER TABLE events ADD CONSTRAINT events_is_live_check
  CHECK (is_live IN ('upcoming', 'live', 'finished'));
