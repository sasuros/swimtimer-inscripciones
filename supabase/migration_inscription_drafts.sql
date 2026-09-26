-- Migración v1.21.0: borrador de la inscripción en el servidor (Sprint 8).
-- Correr UNA vez en Supabase → SQL Editor ANTES de desplegar v1.21.0.
-- Aditiva: crea una tabla nueva, no toca ninguna existente. Idempotente.
-- Compatible con el código actual (v1.20.2): no la conoce. Sin la tabla, v1.21.0 sigue
-- funcionando con el borrador solo en el navegador (el guardado en línea falla en silencio).
-- Un borrador NUNCA es una inscripción: el consolidado, el tablero y "Ver inscripciones"
-- solo leen `inscriptions`.
-- Rollback: revertir el código; la tabla es inofensiva si se queda (o DROP TABLE inscription_drafts).
BEGIN;

CREATE TABLE IF NOT EXISTS inscription_drafts (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  club_code INTEGER NOT NULL REFERENCES clubs(code),
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  author_key TEXT NOT NULL,                       -- correo del v3 ('em'), o 'link' para el v2
  roster JSONB NOT NULL DEFAULT '[]',
  athlete_count INTEGER NOT NULL DEFAULT 0,       -- lo calcula el servidor; es lo único que ve el admin
  base_version INTEGER NOT NULL DEFAULT 0,        -- inscriptions.version sobre la que se editó (0 = sin fila)
  rev INTEGER NOT NULL DEFAULT 1,                 -- sube +1 en cada guardado; decide local vs servidor
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- hora del servidor
  PRIMARY KEY (event_id, club_code, is_late, author_key)
);

CREATE INDEX IF NOT EXISTS idx_inscription_drafts_event ON inscription_drafts(event_id);

-- Solo las funciones /api (service role) leen el roster y escriben.
-- El admin (authenticated) ve solo existencia, fecha y cantidad (privilegio por columna)
-- y puede borrar (purga al archivar). anon: nada.
ALTER TABLE inscription_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON inscription_drafts FROM anon, authenticated;
GRANT SELECT (event_id, club_code, is_late, athlete_count, updated_at) ON inscription_drafts TO authenticated;
GRANT DELETE ON inscription_drafts TO authenticated;
GRANT ALL ON inscription_drafts TO service_role;

DROP POLICY IF EXISTS drafts_admin_select ON inscription_drafts;
DROP POLICY IF EXISTS drafts_admin_delete ON inscription_drafts;
CREATE POLICY drafts_admin_select ON inscription_drafts FOR SELECT TO authenticated USING (true);
CREATE POLICY drafts_admin_delete ON inscription_drafts FOR DELETE TO authenticated USING (true);

COMMIT;

-- Verificación:
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'inscription_drafts';            -- true
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'inscription_drafts';       -- SELECT y DELETE
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_name = 'inscription_drafts' AND grantee IN ('anon', 'authenticated');   -- solo DELETE (authenticated)
-- SELECT grantee, column_name FROM information_schema.column_privileges
--   WHERE table_name = 'inscription_drafts' AND grantee = 'authenticated' AND privilege_type = 'SELECT';
--   -- event_id, club_code, is_late, athlete_count, updated_at (NUNCA roster ni author_key)
