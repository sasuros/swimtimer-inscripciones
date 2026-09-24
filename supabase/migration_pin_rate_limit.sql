-- Migración v1.16.1: límite de intentos del PIN por (IP + token canónico).
-- Correr UNA vez en Supabase → SQL Editor. Sin la tabla la app sigue funcionando
-- (el control falla abierto con un warning en los logs), pero SIN límite de intentos.
-- Aditiva: solo crea una tabla nueva y su índice. Idempotente.
-- RLS activado SIN políticas: anon/authenticated no la ven por PostgREST; solo la usan
-- las funciones /api con la service role (que bypassa RLS).
CREATE TABLE IF NOT EXISTS pin_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip_key TEXT NOT NULL,             -- IPv4, o prefijo /64 en IPv6
  token_key TEXT NOT NULL,          -- tokens.id (hash del token largo canónico)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pin_attempts_key_idx ON pin_attempts(ip_key, token_key, created_at);
ALTER TABLE pin_attempts ENABLE ROW LEVEL SECURITY;

-- Verificación:
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'pin_attempts';   -- true
-- SELECT count(*) FROM pg_policies WHERE tablename = 'pin_attempts';    -- 0
