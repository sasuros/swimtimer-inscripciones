export const DEMO_MODE = !import.meta.env.VITE_SUPABASE_URL
export const DEMO_ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'swimtimer2025'
export const DEMO_WHATSAPP = import.meta.env.VITE_ALBERTO_WHATSAPP || '584120000000'

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
