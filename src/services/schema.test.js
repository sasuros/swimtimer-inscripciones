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
})
