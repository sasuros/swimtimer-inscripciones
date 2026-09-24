-- Migración v1.11.0: una sola inscripción por (event_id, club_code, is_late).
-- Correr UNA vez en Supabase → SQL Editor ANTES de desplegar v1.11.0
-- (el envío pasa a usar upsert onConflict y necesita este UNIQUE).
-- Idempotente: se puede volver a correr sin efectos.
BEGIN;

-- Frena envíos concurrentes mientras dura la migración.
LOCK TABLE inscriptions IN SHARE ROW EXCLUSIVE MODE;

-- (a) Dedupe con respaldo. Se conserva la fila más reciente de cada grupo,
--     la misma que ya muestran el wizard, el dashboard y la revisión de tardías.
--     En una base limpia no mueve ninguna fila.
CREATE TABLE IF NOT EXISTS inscriptions_dup_backup AS SELECT * FROM inscriptions WHERE false;
UPDATE inscriptions SET is_late = false WHERE is_late IS NULL;
INSERT INTO inscriptions_dup_backup
  SELECT i.* FROM inscriptions i
  JOIN (
    SELECT id, row_number() OVER (PARTITION BY event_id, club_code, is_late ORDER BY submitted_at DESC, id DESC) AS rn
    FROM inscriptions
  ) r ON r.id = i.id
  WHERE r.rn > 1
    AND NOT EXISTS (SELECT 1 FROM inscriptions_dup_backup b WHERE b.id = i.id);
DELETE FROM inscriptions WHERE id IN (SELECT id FROM inscriptions_dup_backup);

-- (b) Columnas de la clave sin NULL (un NULL dejaría pasar duplicados) + UNIQUE.
ALTER TABLE inscriptions ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE inscriptions ALTER COLUMN is_late SET NOT NULL;
ALTER TABLE inscriptions DROP CONSTRAINT IF EXISTS inscriptions_event_club_late_key;
ALTER TABLE inscriptions ADD CONSTRAINT inscriptions_event_club_late_key UNIQUE (event_id, club_code, is_late);

COMMIT;

-- Verificación (debe devolver 0 y el constraint):
-- SELECT count(*) FROM (SELECT 1 FROM inscriptions GROUP BY event_id, club_code, is_late HAVING count(*) > 1) d;
-- SELECT conname FROM pg_constraint WHERE conname = 'inscriptions_event_club_late_key';
