-- Migración v1.17.0: enlaces cortos (/inscribir?t=<10 caracteres>).
-- Correr UNA vez en Supabase → SQL Editor ANTES de desplegar v1.17.0: sin la columna,
-- "Crear enlace nuevo" y el envío por correo fallan al escribir short_id.
-- Aditiva: solo agrega una columna (NULL en las filas existentes; la app la llena
-- de a poco al abrir el tablero) y un índice único parcial. Idempotente.
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS short_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS tokens_short_id_key ON tokens(short_id) WHERE short_id IS NOT NULL;

-- Verificación:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'tokens' AND column_name = 'short_id';
-- SELECT indexname FROM pg_indexes WHERE indexname = 'tokens_short_id_key';
