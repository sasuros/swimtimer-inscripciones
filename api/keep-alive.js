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
