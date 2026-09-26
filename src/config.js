import { supabase } from './services/supabase'

export const DEMO_MODE = !supabase
// v1.20.1: clave de firma de los enlaces v3, sin valor por defecto (falla cerrado).
export const MAGIC_SIGNING_KEY = import.meta.env.VITE_ADMIN_PASSWORD || ''
// Solo modo demo local (sin Supabase): no firma nada y se muestra en pantalla.
export const DEMO_LOGIN_PASSWORD = 'demo'
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
