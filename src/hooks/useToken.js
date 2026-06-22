import { useEffect, useState } from 'react'

export default function useToken(token) {
  const [state, setState] = useState({ loading: true, valid: false })
  useEffect(() => {
    if (!token) return setState({ loading: false, valid: false })
    fetch('/api/validate-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async response => ({ ok: response.ok, data: await response.json() }))
      .then(({ ok, data }) => setState({ loading: false, valid: ok && data.valid, ...data }))
      .catch(() => setState({ loading: false, valid: false, networkError: true }))
  }, [token])
  return state
}
