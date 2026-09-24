-- Migración v1.18.0: versión por fila en inscriptions (guardias anti-pisado).
-- Correr UNA vez en Supabase → SQL Editor ANTES de desplegar v1.18.0: el código nuevo
-- escribe y filtra por `version`; sin la columna, el envío y la revisión de tardías FALLAN.
-- Aditiva e idempotente. Compatible con el código actual (v1.17.1): su upsert no nombra
-- `version` (al insertar toma el DEFAULT 1, al actualizar no la toca) y sus select('*')
-- la ignoran. Las filas existentes quedan en 1. En PG11+ no reescribe la tabla.
-- Rollback: revertir el código; la columna es inofensiva si se queda.
ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Verificación:
-- SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
--   WHERE table_name = 'inscriptions' AND column_name = 'version';        -- integer | NO | 1
-- SELECT count(*) FROM inscriptions WHERE version IS DISTINCT FROM 1;      -- 0 (recién migrada)
