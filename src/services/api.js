import { DEMO_MODE } from '../config'
import { demoAddMasterClub, demoCloneEvent, demoDashboard, demoDeleteEvent, demoExportAll, demoGenerateTokens, demoGetEvent, demoGetInscription, demoGetMasterClubs, demoListEvents, demoLogin, demoReviewLate, demoSaveEvent, demoSetClubParticipation, demoSubmitInscription, demoUpdateEventStatus, demoValidateToken } from './demoStorage'

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

export const getDashboard = eventId => DEMO_MODE
  ? Promise.resolve(demoDashboard(eventId))
  : fetch(`/api/admin/dashboard?eventId=${encodeURIComponent(eventId)}`, { headers: authHeaders() }).then(parse)

export const generateTokens = eventId => DEMO_MODE
  ? Promise.resolve(demoGenerateTokens(eventId))
  : fetch('/api/admin/generate-tokens', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId }) }).then(parse)

export const getInscription = (eventId, clubCode) => DEMO_MODE
  ? Promise.resolve(demoGetInscription(eventId, clubCode))
  : fetch(`/api/admin/inscription/${clubCode}?eventId=${encodeURIComponent(eventId)}`, { headers: authHeaders() }).then(parse)

export const exportAll = (eventId, type = 'principal') => DEMO_MODE
  ? Promise.resolve(demoExportAll(eventId, type))
  : fetch(`/api/admin/export-all?eventId=${encodeURIComponent(eventId)}&type=${encodeURIComponent(type)}`, { headers: authHeaders() }).then(parse)

export const reviewLate = (eventId, clubCode, action, athleteIds) => DEMO_MODE
  ? Promise.resolve(demoReviewLate(eventId, clubCode, action, athleteIds))
  : fetch('/api/admin/late/review', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, clubCode, action, athleteIds }) }).then(parse)

export const listEvents = () => DEMO_MODE ? Promise.resolve(demoListEvents()) : fetch('/api/admin/events', { headers: authHeaders() }).then(parse)
export const getEvent = id => DEMO_MODE ? Promise.resolve(demoGetEvent(id)) : fetch(`/api/admin/events/${id}`, { headers: authHeaders() }).then(parse)
export const getMasterClubs = () => DEMO_MODE ? Promise.resolve(demoGetMasterClubs()) : fetch('/api/admin/clubs', { headers: authHeaders() }).then(parse)
export const addMasterClub = club => DEMO_MODE ? Promise.resolve(demoAddMasterClub(club)) : fetch('/api/admin/clubs', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(club) }).then(parse)
export const saveEvent = (event, activate = false) => DEMO_MODE ? Promise.resolve(demoSaveEvent(event, activate)) : fetch('/api/admin/events', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ event, activate }) }).then(parse)
export const updateEventStatus = (id, status) => DEMO_MODE ? Promise.resolve(demoUpdateEventStatus(id, status)) : fetch(`/api/admin/events/${id}/status`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).then(parse)
export const cloneEvent = id => DEMO_MODE ? Promise.resolve(demoCloneEvent(id)) : fetch(`/api/admin/events/${id}/clone`, { headers: authHeaders() }).then(parse)
export const deleteEvent = id => DEMO_MODE ? Promise.resolve(demoDeleteEvent(id)) : fetch(`/api/admin/events/${id}`, { method: 'DELETE', headers: authHeaders() }).then(parse)
export const setClubParticipation = (eventId, clubCode, participates) => DEMO_MODE ? Promise.resolve(demoSetClubParticipation(eventId, clubCode, participates)) : fetch(`/api/admin/events/${eventId}/clubs/${clubCode}/participation`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ participates }) }).then(parse)
