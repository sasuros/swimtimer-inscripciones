import { supabase } from './supabase'

export const DEMO_PUBLIC_EVENTS = [
  { id: 'demo-live', name: 'Copa 68 Aniversario Ctro. Portugués', date_start: '2026-06-18', date_end: '2026-06-19', venue: 'Centro Portugués', drive_url: 'https://drive.google.com/drive/folders/example', is_live: true, status: 'active', athletes: 246, events: 82, teams: 11 },
  { id: 'demo-finished', name: 'V Copa Navidad Mantarrayas 2026', date_start: '2026-12-15', date_end: null, venue: 'Piscina Municipal de Baruta', drive_url: 'https://drive.google.com/drive/folders/example2', is_live: false, status: 'closed' }
]

export async function getPublicEvents() {
  if (!supabase) return DEMO_PUBLIC_EVENTS
  const { data, error } = await supabase.from('events')
    .select('id,name,date_start,date_end,venue,drive_url,is_live,status')
    .in('status', ['active', 'closed', 'archived'])
    .neq('drive_url', '')
    .eq('show_on_landing', true)
    .order('is_live', { ascending: false })
    .order('date_start', { ascending: false })
    .limit(10)
  if (error) throw new Error('Los resultados estarán disponibles durante el evento.')
  return data || []
}
