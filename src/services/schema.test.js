import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('schema Supabase', () => {
  it('incluye tablas, RLS deshabilitado y token completo separado del hash', () => {
    const sql = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
    for (const table of ['events', 'clubs', 'event_clubs', 'event_events', 'tokens', 'inscriptions']) {
      expect(sql).toContain(`CREATE TABLE ${table}`)
      expect(sql).toContain(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`)
    }
    expect(sql).toContain('token_value TEXT NOT NULL')
    expect(sql).toContain('approved_athletes JSONB')
  })
})
