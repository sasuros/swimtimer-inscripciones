// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// v1.18.0 — Imprimir / Descargar PDF desde "Ver inscripciones": la hoja imprimible vive fuera
// del modal fijo y del tablero (#root, que al imprimir queda .no-print = display:none), en flujo
// normal, con la regular completa y TODAS las tardías aprobadas. Club 5: 13 regulares
// (R0..R12) + tardías T0 (aprobada), T1 (rechazada), T2 (aprobada).
vi.mock('../services/api', async () => {
  const storage = await import('../services/supabaseStorage.js')
  const stub = async () => ({ success: true })
  return { ...storage, generateEmailInvitations: stub, recordInvitationResults: stub, revokeMagicInvitation: stub, sendInvitationEmails: stub, updateLandingSettings: stub }
})

const { default: AdminDashboard } = await import('../pages/AdminDashboard.jsx')
const { __setSupabaseClient, getDashboard, reviewLate } = await import('../services/supabaseStorage.js')
const { payload, seed } = await import('../services/testSupport/fakeSupabase.js')
const { createSupabaseWizardStorage } = await import('../services/wizardSupabase.js')
const { MAGIC_SIGNING_KEY } = await import('../config.js')
const { button, click, mount, settle, unmountAll } = await import('../services/testSupport/dom.js')

const sheet = () => document.getElementById('print-roster')
const lines = () => [...sheet().querySelectorAll('p.font-bold')].map((p) => p.textContent.split(',')[0])

beforeEach(async () => {
  const { db, token } = await seed()
  const wizard = createSupabaseWizardStorage({ client: db, adminPassword: MAGIC_SIGNING_KEY })
  await wizard.submitInscription(payload(token, 13, 'R'))
  db.tables.events[0].status = 'accepting_late'
  await wizard.submitInscription(payload(token, 3, 'T'))
  await reviewLate('evt-1', 5, 'approve', [5001, 5003], (await getDashboard('evt-1')).late[0])
  await reviewLate('evt-1', 5, 'reject', [5002], (await getDashboard('evt-1')).late[0])
  await mount(<AdminDashboard eventId="evt-1" />, { id: 'root' })
  await settle()
  await click(button('Ver inscripciones'))
  await settle()
})
afterEach(async () => {
  await unmountAll()
  __setSupabaseClient(null)
})

describe('Imprimir / Descargar PDF', () => {
  it('la hoja es hija directa de <body>: fuera del modal fijo y del tablero', () => {
    expect(sheet().parentElement).toBe(document.body)
    expect(sheet().closest('#root')).toBeNull()
    expect(sheet().closest('.fixed')).toBeNull()
  })

  it('al imprimir el tablero entero queda fuera (#root .no-print) y la hoja va en flujo normal', () => {
    expect(document.getElementById('root').classList.contains('no-print')).toBe(true)
    expect(sheet().style.position).toBe('static')
    expect(sheet().textContent).not.toMatch(/Clubes y enlaces|Inscripciones tardías|Resultados en vivo|Tardías revisadas|Rechazado/)
  })

  it('completa: las 13 regulares y todas las tardías aprobadas (no la rechazada), numeradas seguidas', () => {
    const regular = Array.from({ length: 13 }, (_, i) => `R${i}`).sort((a, b) => a.localeCompare(b, 'es'))
    expect(lines()).toEqual([...regular, 'T0', 'T2'])
    expect(sheet().textContent).toContain('Tardías aprobadas')
    expect(sheet().textContent).toContain('15.')
    expect([...sheet().querySelectorAll('[style*="break-inside"]')]).toHaveLength(15)
  })

  it('al cerrar el modal la hoja sale del body y el tablero vuelve a imprimirse normal', async () => {
    // "Cerrar definitivamente" también contiene "Cerrar": se busca el botón exacto del modal.
    await click([...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Cerrar'))
    expect(sheet()).toBeNull()
    expect(document.getElementById('root').classList.contains('no-print')).toBe(false)
  })
})
