import { DEMO_MODE } from '../config'
import * as demo from './demoStorage'
import * as production from './supabaseStorage'

const storage = DEMO_MODE ? {
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
  cloneEvent: demo.demoCloneEvent,
  deleteEvent: demo.demoDeleteEvent,
  setClubParticipation: demo.demoSetClubParticipation
} : production

export const validateToken = (...args) => Promise.resolve(storage.validateToken(...args))
export const submitInscription = (...args) => Promise.resolve(storage.submitInscription(...args))
export const adminLogin = (...args) => Promise.resolve(storage.adminLogin(...args))
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
export const cloneEvent = (...args) => Promise.resolve(storage.cloneEvent(...args))
export const deleteEvent = (...args) => Promise.resolve(storage.deleteEvent(...args))
export const setClubParticipation = (...args) => Promise.resolve(storage.setClubParticipation(...args))

// Nombres de contrato de Fase 5 para integraciones futuras.
export const getEvents = listEvents
export const createEvent = (data) => saveEvent(data, false)
export const updateEvent = (id, data) => saveEvent({ ...data, id }, false)
