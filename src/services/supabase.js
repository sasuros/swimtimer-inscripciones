import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export function isValidSupabaseUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function createSupabaseClient(url, key, factory = createClient) {
  const cleanUrl = String(url || '').trim()
  const cleanKey = String(key || '').trim()
  if (!isValidSupabaseUrl(cleanUrl) || !cleanKey) return null
  try {
    return factory(cleanUrl, cleanKey)
  } catch (error) {
    console.warn('Supabase no pudo configurarse; se usará el modo demo.', error)
    return null
  }
}

export const supabase = createSupabaseClient(supabaseUrl, supabaseKey)
