import { supabase } from './services/supabase'

export const DEMO_MODE = !supabase
export const DEMO_ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'swimtimer2025'
// v1.19.2: sin la variable, vacío (antes un número de relleno que se guardaba en los eventos).
export const DEMO_WHATSAPP = import.meta.env.VITE_ALBERTO_WHATSAPP || ''

export const STORAGE_KEYS = {
  tokens: 'swimtimer-demo:tokens',
  inscriptions: 'swimtimer-demo:inscriptions',
  eventsList: 'swimtimer-demo:events:list',
  eventsPrefix: 'swimtimer-demo:event:',
  clubsMaster: 'swimtimer-demo:clubs:master',
  eventsTemplate: 'swimtimer-demo:events:template',
  lateInscriptions: 'swimtimer-demo:inscriptions:late',
  clubParticipation: 'swimtimer-demo:club-participation'
}
