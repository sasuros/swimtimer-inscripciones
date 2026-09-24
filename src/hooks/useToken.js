import { useEffect, useState } from 'react'
import { validateToken } from '../services/api'
import { DEMO_MODE } from '../config'
import { accessFromDemoToken, decodeDemoToken } from '../utils/demoToken'

// v1.16.0: con PIN, el servidor devuelve el acceso completo (roster incluido);
// sin PIN, solo lo básico para mostrar la pantalla del código.
export default function useToken(token, pin = '') {
  const [state, setState] = useState({ loading: true, valid: false })
  useEffect(() => {
    if (!token) return setState({ loading: false, valid: false, noToken: true })
    setState((current) => ({ ...current, loading: true }))
    const embedded = DEMO_MODE ? decodeDemoToken(token) : null
    validateToken(token, pin || undefined)
      .then(data => setState({ loading: false, ...data }))
      .catch(() => setState(embedded
        ? { loading: false, ...accessFromDemoToken(embedded), backendAvailable: false, networkError: true }
        : { loading: false, valid: false, networkError: true }))
  }, [token, pin])
  return state
}
