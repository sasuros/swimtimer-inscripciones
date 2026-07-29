import { DEMO_MODE } from '../config'
import * as demo from './demoStorage'
import * as production from './supabaseStorage'
import { supabase } from './supabase'

const storage = DEMO_MODE
  ? {
      validateToken: demo.demoValidateToken,
      submitInscription: demo.demoSubmitInscription,
      adminLogin: demo.demoLogin,
      getDashboard: demo.demoDashboard,
      generateTokens: demo.demoGenerateTokens,
      getInscription: demo.demoGetInscription,
      exportAll: demo.demoExportAll,
      reviewLate: demo.demoReviewLate,
      listEvents: demo.demoListEvents,
      getEvent: demo.demoGetEvent,
      getMasterClubs: demo.demoGetMasterClubs,
      addMasterClub: demo.demoAddMasterClub,
      saveEvent: demo.demoSaveEvent,
      updateEventStatus: demo.demoUpdateEventStatus,
      updateLandingSettings: demo.demoUpdateLandingSettings,
      cloneEvent: demo.demoCloneEvent,
      deleteEvent: demo.demoDeleteEvent,
      setClubParticipation: demo.demoSetClubParticipation,
      updateClubPin: demo.demoUpdateClubPin,
      verifyAccessPin: demo.demoVerifyAccessPin
    }
  : production

async function postPublicWizard(path, body, fallbackMessage) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || fallbackMessage)
  return data
}

export const validateToken = (token) =>
  DEMO_MODE
    ? Promise.resolve(storage.validateToken(token))
    : postPublicWizard('/api/validate-token', { token }, 'No se pudo validar el enlace')

export const submitInscription = (payload) =>
  DEMO_MODE
    ? Promise.resolve(storage.submitInscription(payload))
    : postPublicWizard('/api/submit-inscription', payload, 'No se pudo enviar la inscripcion')
export const adminLogin = (...args) =>
  DEMO_MODE
    ? Promise.resolve(storage.adminLogin(...args))
    : Promise.reject(new Error('El panel usa Supabase Auth en produccion'))
export const getDashboard = (...args) => Promise.resolve(storage.getDashboard(...args))
export const generateTokens = (...args) => Promise.resolve(storage.generateTokens(...args))
export const getInscription = (...args) => Promise.resolve(storage.getInscription(...args))
export const exportAll = (...args) => Promise.resolve(storage.exportAll(...args))
export const reviewLate = (...args) => Promise.resolve(storage.reviewLate(...args))
export const listEvents = (...args) => Promise.resolve(storage.listEvents(...args))
export const getEvent = (...args) => Promise.resolve(storage.getEvent(...args))
export const getMasterClubs = (...args) => Promise.resolve(storage.getMasterClubs(...args))
export const addMasterClub = (...args) => Promise.resolve(storage.addMasterClub(...args))
export const saveEvent = (...args) => Promise.resolve(storage.saveEvent(...args))
export const updateEventStatus = (...args) => Promise.resolve(storage.updateEventStatus(...args))
export const updateLandingSettings = (...args) => Promise.resolve(storage.updateLandingSettings(...args))
export const cloneEvent = (...args) => Promise.resolve(storage.cloneEvent(...args))
export const deleteEvent = (...args) => Promise.resolve(storage.deleteEvent(...args))
export const setClubParticipation = (...args) => Promise.resolve(storage.setClubParticipation(...args))
export const updateClubPin = (...args) => Promise.resolve(storage.updateClubPin(...args))
export const verifyAccessPin = (token, pin) =>
  DEMO_MODE
    ? Promise.resolve(storage.verifyAccessPin(token, pin))
    : postPublicWizard('/api/verify-pin', { token, pin }, 'No se pudo verificar el PIN')
export const generateEmailInvitations = (...args) => (DEMO_MODE ? Promise.reject(new Error("El envío de correos requiere el modo producción con Supabase y Resend configurados. Usa 'Copiar enlace' o 'WhatsApp' en modo demo.")) : production.generateEmailInvitations(...args))
export const recordInvitationResults = (...args) => (DEMO_MODE ? Promise.resolve({ success: true }) : production.recordInvitationResults(...args))
export const revokeMagicInvitation = (...args) => (DEMO_MODE ? Promise.resolve({ success: true }) : production.revokeMagicInvitation(...args))
export async function sendInvitationEmails(invitations) {
  const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Sesion de administrador no disponible')
  const response = await fetch('/api/send-invitation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ invitations })
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'No se pudieron enviar las invitaciones')
  return data.results
}

// Nombres de contrato de Fase 5 para integraciones futuras.
export const getEvents = listEvents
export const createEvent = (data) => saveEvent(data, false)
export const updateEvent = (id, data) => saveEvent({ ...data, id }, false)
