import { supabase } from './supabase'

export const DEMO_PUBLIC_EVENTS = [
  { id: 'demo-live', name: 'Copa 68 Aniversario Ctro. Portugués', date_start: '2026-06-18', date_end: '2026-06-19', venue: 'Centro Portugués', drive_url: 'https://drive.google.com/drive/folders/example', is_live: 'live', status: 'active', athletes: 246, events: 82, teams: 11 },
  { id: 'demo-upcoming', name: 'V Copa Navidad Mantarrayas 2026', date_start: '2026-12-15', date_end: null, venue: 'Piscina Municipal de Baruta', drive_url: '', is_live: 'upcoming', status: 'active' }
]

const STATE_PRIORITY = { live: 0, upcoming: 1, finished: 2 }

export function normalizePublicEventState(value) {
  if (value === true) return 'live'
  if (value === false) return 'finished'
  return Object.hasOwn(STATE_PRIORITY, value) ? value : 'upcoming'
}

export function sortPublicEvents(events) {
  return [...events].map(event => ({ ...event, is_live: normalizePublicEventState(event.is_live) })).sort((a, b) => {
    const byState = STATE_PRIORITY[a.is_live] - STATE_PRIORITY[b.is_live]
    return byState || String(b.date_start || '').localeCompare(String(a.date_start || ''))
  })
}

export async function getPublicEvents() {
  if (!supabase) return sortPublicEvents(DEMO_PUBLIC_EVENTS)
  const { data, error } = await supabase.from('events')
    .select('id,name,date_start,date_end,venue,drive_url,is_live,status')
    .in('status', ['active', 'closed', 'archived'])
    .eq('show_on_landing', true)
    .order('date_start', { ascending: false })
    .limit(10)
  if (error) throw new Error('Los resultados estarán disponibles durante el evento.')
  return sortPublicEvents(data || [])
}
