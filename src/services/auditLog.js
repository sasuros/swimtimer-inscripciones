// Audit log (v1.14.0): registro solo-agregar de acciones del admin.
// Privacidad: details pasa por pickSafe (lista blanca de claves Y de valores);
// nunca viaja un valor editado, un nombre ni una fecha, solo referencias.

const STATUSES = ['draft', 'active', 'accepting_late', 'closed', 'archived']
const VIAS = ['editor', 'dashboard']

// Nombres de campo que puede registrar event.details_updated.
export const AUDIT_FIELDS = ['name', 'date_start', 'date_end', 'venue', 'deadline', 'course', 'notes', 'drive_url', 'is_live', 'show_on_landing', 'organizer', 'organizer_whatsapp', 'imported_from', 'clubs', 'pruebas']

export function statusAction(from, to) {
  if (from === to) return 'event.status_changed'
  if (to === 'active') {
    if (from === 'draft') return 'event.activated'
    if (['closed', 'archived', 'accepting_late'].includes(from)) return 'event.reopened'
  }
  if (to === 'accepting_late' && from === 'active') return 'event.closed_accepting_late'
  if (to === 'closed') return 'event.closed_final'
  if (to === 'archived') return 'event.archived'
  return 'event.status_changed'
}

export function pickSafe(details = {}) {
  const safe = {}
  if (STATUSES.includes(details.from)) safe.from = details.from
  if (STATUSES.includes(details.to)) safe.to = details.to
  if (VIAS.includes(details.via)) safe.via = details.via
  if (Array.isArray(details.campos)) safe.campos = [...new Set(details.campos.filter((field) => AUDIT_FIELDS.includes(field)))].sort()
  return safe
}

// No bloqueante: nunca lanza. Si el insert falla, la acción principal sigue igual.
// Se espera con await (no fire-and-forget) porque el editor navega apenas guarda.
export async function logAdminAction(client, { action, eventId = null, clubCode = null, details = {}, outcome = 'success' }) {
  if (!client) return
  try {
    const { error } = await client.from('audit_log').insert({
      action,
      event_id: eventId,
      club_code: clubCode,
      details: pickSafe(details),
      outcome: outcome === 'failure' ? 'failure' : 'success'
    })
    if (error) console.warn('audit_log:', error.message)
  } catch (error) {
    console.warn('audit_log:', error?.message)
  }
}
