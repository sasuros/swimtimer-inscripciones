import { useEffect, useState } from 'react'
import { validateToken } from '../services/api'

export default function useToken(token) {
  const [state, setState] = useState({ loading: true, valid: false })
  useEffect(() => {
    if (!token) return setState({ loading: false, valid: false })
    validateToken(token)
      .then(data => setState({ loading: false, ...data }))
      .catch(() => setState({ loading: false, valid: false, networkError: true }))
  }, [token])
  return state
}
