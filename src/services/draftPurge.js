// v1.21.0 — Purga diaria (cron de keep-alive): borradores de eventos cerrados o archivados
// hace más de DRAFT_RETENTION_DAYS. Usa la service role. Lanza ante un error: quien la llama
// decide (keep-alive la aísla para no romper su propósito original).
export const DRAFT_RETENTION_DAYS = 30

export async function purgeStaleDrafts(client, { now = Date.now() } = {}) {
  const cutoff = new Date(now - DRAFT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const events = await client.from('events').select('id').in('status', ['closed', 'archived']).lt('closed_at', cutoff)
  if (events.error) throw events.error
  const ids = (events.data || []).map((row) => row.id)
  if (!ids.length) return { events: 0 }
  const deleted = await client.from('inscription_drafts').delete().in('event_id', ids)
  if (deleted.error) throw deleted.error
  return { events: ids.length }
}
