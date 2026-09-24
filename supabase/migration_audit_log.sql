-- Migración v1.14.0: audit log (solo-agregar) de acciones del admin.
-- Correr UNA vez en Supabase → SQL Editor ANTES de desplegar v1.14.0.
-- Aditiva: crea una tabla nueva, no toca ninguna existente. Idempotente.
-- Privacidad: details solo lleva referencias (from/to/via/nombres de campos), jamás datos de nadadores.
BEGIN;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor TEXT NOT NULL DEFAULT (auth.jwt() ->> 'email'),
  actor_type TEXT NOT NULL DEFAULT 'admin' CHECK (actor_type IN ('admin', 'coach', 'system')),
  action TEXT NOT NULL,
  event_id TEXT,        -- sin FK a propósito: el historial sobrevive al borrado del evento
  club_code INTEGER,
  details JSONB NOT NULL DEFAULT '{}',
  outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'failure'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event_id, created_at DESC);

-- Append-only: el admin inserta (firmado con su propio email) y lee; nadie edita ni borra.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_insert ON audit_log;
DROP POLICY IF EXISTS audit_select ON audit_log;
CREATE POLICY audit_insert ON audit_log FOR INSERT TO authenticated
  WITH CHECK (actor = auth.jwt() ->> 'email');
CREATE POLICY audit_select ON audit_log FOR SELECT TO authenticated USING (true);
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM authenticated, anon;
REVOKE INSERT, SELECT ON audit_log FROM anon;

COMMIT;

-- Verificación:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'audit_log';  -- solo INSERT y SELECT
