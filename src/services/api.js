import { DEMO_MODE } from '../config'
import { demoDashboard, demoExportAll, demoGenerateTokens, demoGetInscription, demoLogin, demoSubmitInscription, demoValidateToken } from './demoStorage'

const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('swimtimer-admin-token')}` })
const parse = async response => {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación')
  return data
}

export const validateToken = token => DEMO_MODE
  ? Promise.resolve(demoValidateToken(token))
  : fetch('/api/validate-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).then(parse)

export const submitInscription = payload => DEMO_MODE
  ? Promise.resolve(demoSubmitInscription(payload))
  : fetch('/api/submit-inscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(parse)

export const adminLogin = password => DEMO_MODE
  ? Promise.resolve(demoLogin(password))
  : fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }).then(parse)

export const getDashboard = () => DEMO_MODE
  ? Promise.resolve(demoDashboard())
  : fetch('/api/admin/dashboard', { headers: authHeaders() }).then(parse)

export const generateTokens = () => DEMO_MODE
  ? Promise.resolve(demoGenerateTokens())
  : fetch('/api/admin/generate-tokens', { method: 'POST', headers: authHeaders() }).then(parse)

export const getInscription = clubCode => DEMO_MODE
  ? Promise.resolve(demoGetInscription(clubCode))
  : fetch(`/api/admin/inscription/${clubCode}`, { headers: authHeaders() }).then(parse)

export const exportAll = () => DEMO_MODE
  ? Promise.resolve(demoExportAll())
  : fetch('/api/admin/export-all', { headers: authHeaders() }).then(parse)
