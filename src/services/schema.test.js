import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('schema Supabase', () => {
  it('incluye tablas, RLS activo y token completo separado del hash', () => {
    const sql = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
    for (const table of ['events', 'clubs', 'event_clubs', 'event_events', 'tokens', 'inscriptions']) {
      expect(sql).toContain(`CREATE TABLE ${table}`)
      expect(sql).toContain(`ALTER TABLE ${table}`)
      expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    }
    expect(sql).toContain('CREATE POLICY auth_all_events')
    expect(sql).toContain('CREATE POLICY anon_public_events')
    expect(sql).toContain('token_value TEXT NOT NULL')
    expect(sql).toContain('approved_athletes JSONB')
  })

  it('garantiza una sola inscripción por club, evento y tipo (normal/tardía)', () => {
    const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
    const migration = readFileSync(new URL('../../supabase/migration_inscriptions_unique.sql', import.meta.url), 'utf8')
    for (const sql of [schema, migration]) expect(sql).toContain('CONSTRAINT inscriptions_event_club_late_key UNIQUE (event_id, club_code, is_late)')
    expect(schema).toContain('event_id TEXT NOT NULL REFERENCES events(id)')
    expect(schema).toContain('is_late BOOLEAN NOT NULL DEFAULT FALSE')
    expect(migration).toContain('ALTER COLUMN event_id SET NOT NULL')
    expect(migration).toContain('ALTER COLUMN is_late SET NOT NULL')
    expect(migration).toMatch(/BEGIN;[\s\S]*COMMIT;/)
  })

  it('audit_log es solo-agregar: RLS, INSERT firmado por el actor, sin UPDATE/DELETE ni FOR ALL', () => {
    const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
    const migration = readFileSync(new URL('../../supabase/migration_audit_log.sql', import.meta.url), 'utf8')
    for (const sql of [schema, migration]) {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS audit_log')
      expect(sql).toContain('ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY')
      expect(sql).toMatch(/CREATE POLICY audit_insert ON audit_log FOR INSERT TO authenticated\s+WITH CHECK \(actor = auth\.jwt\(\) ->> 'email'\)/)
      expect(sql).toContain('REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM authenticated, anon')
      expect(sql.match(/CREATE POLICY \w+ ON audit_log FOR \w+/g)).toEqual(['CREATE POLICY audit_insert ON audit_log FOR INSERT', 'CREATE POLICY audit_select ON audit_log FOR SELECT'])
      const table = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS audit_log'), sql.indexOf(');', sql.indexOf('CREATE TABLE IF NOT EXISTS audit_log')))
      expect(table).not.toContain('REFERENCES')
    }
    expect(migration).toMatch(/BEGIN;[\s\S]*COMMIT;/)
    expect(migration).not.toMatch(/ALTER TABLE (?!audit_log)\w+/)
  })

  it('enlaces cortos: tokens.short_id con índice único parcial; la migración solo agrega', () => {
    const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
    const migration = readFileSync(new URL('../../supabase/migration_short_links.sql', import.meta.url), 'utf8')
    expect(schema).toContain('short_id TEXT')
    expect(schema).toContain('CREATE UNIQUE INDEX tokens_short_id_key ON tokens(short_id) WHERE short_id IS NOT NULL')
    expect(migration).toContain('ALTER TABLE tokens ADD COLUMN IF NOT EXISTS short_id TEXT;')
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS tokens_short_id_key ON tokens(short_id) WHERE short_id IS NOT NULL;')
    const statements = migration.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('--'))
    expect(statements).toHaveLength(2)
    expect(migration).not.toMatch(/DROP|ALTER COLUMN|UPDATE |DELETE /)
  })

  it('pin_attempts (v1.16.1): RLS sin políticas; la migración solo crea tabla + índice', () => {
    const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
    const migration = readFileSync(new URL('../../supabase/migration_pin_rate_limit.sql', import.meta.url), 'utf8')
    for (const sql of [schema, migration]) {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS pin_attempts')
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS pin_attempts_key_idx ON pin_attempts(ip_key, token_key, created_at)')
      expect(sql).toContain('ALTER TABLE pin_attempts ENABLE ROW LEVEL SECURITY')
      expect(sql).not.toMatch(/CREATE POLICY \w+ ON pin_attempts/)
    }
    const code = migration.split(/\r?\n/).filter((line) => !line.trim().startsWith('--')).join('\n')
    expect(code).not.toMatch(/DROP|ALTER COLUMN|UPDATE |DELETE |INSERT |GRANT/)
    expect(code).not.toMatch(/ALTER TABLE (?!pin_attempts)\w+/)
  })

  it('inscriptions.version (v1.18.0): entero NOT NULL DEFAULT 1; la migración solo agrega la columna', () => {
    const schema = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
    const migration = readFileSync(new URL('../../supabase/migration_inscriptions_version.sql', import.meta.url), 'utf8')
    expect(schema).toMatch(/version INTEGER NOT NULL DEFAULT 1/)
    expect(migration).toContain('ALTER TABLE inscriptions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;')
    const code = migration.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('--'))
    expect(code).toHaveLength(1)
  })
})
