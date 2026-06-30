import { useEffect, useState } from 'react'
import { validateToken } from '../services/api'
import { DEMO_MODE } from '../config'
import { accessFromDemoToken, decodeDemoToken } from '../utils/demoToken'

export default function useToken(token) {
  const [state, setState] = useState({ loading: true, valid: false })
  useEffect(() => {
    if (!token) return setState({ loading: false, valid: false })
    const embedded = DEMO_MODE ? decodeDemoToken(token) : null
    if (embedded) setState({ loading: false, ...accessFromDemoToken(embedded), localMode: false })
    validateToken(token)
      .then(data => setState({ loading: false, ...data }))
      .catch(() => setState({ loading: false, valid: false, networkError: true }))
  }, [token])
  return state
}
