import { createClient } from '@supabase/supabase-js'
import { purgeStaleDrafts } from '../src/services/draftPurge.js'

// v1.21.0: además purga los borradores viejos. Aislado: si la purga falla (o falta la
// service role), keep-alive responde igual que siempre.
async function purgeDrafts() {
  try {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
    if (!supabaseUrl || !serviceRoleKey) return 'skipped'
    await purgeStaleDrafts(createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }))
    return 'ok'
  } catch (error) {
    console.warn('[keep-alive] purga de borradores:', error?.message || error)
    return 'failed'
  }
}

export default async function handler(req, res) {
  try {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim()
    const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim()

    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({
        alive: false,
        error: 'Supabase no configurado',
        timestamp: new Date().toISOString()
      })
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/events?select=id&limit=1`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    })

    return res.status(200).json({
      alive: response.ok,
      drafts_purge: await purgeDrafts(),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return res.status(200).json({
      alive: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
