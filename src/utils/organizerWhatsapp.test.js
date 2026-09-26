import { afterEach, describe, expect, it } from 'vitest'
import { organizerWhatsapp } from './organizerWhatsapp'
import { __setSupabaseClient, getEvent, saveEvent } from '../services/supabaseStorage'
import { seed } from '../services/testSupport/fakeSupabase'
import { DEMO_WHATSAPP } from '../config'

// v1.19.2: el botón "Contactar por WhatsApp" salía con 584120000000 (relleno).
describe('número de WhatsApp del organizador', () => {
  it('un número real se devuelve limpio, listo para wa.me', () => {
    expect(organizerWhatsapp('584149990123')).toBe('584149990123')
    expect(organizerWhatsapp('+58 414-999.0123')).toBe('584149990123')
  })

  it.each([['vacío', ''], ['null', null], ['undefined', undefined], ['relleno de antes', '584120000000'], ['placeholder del editor', '584121234567'], ['muy corto', '12345'], ['muy largo', '5841499901231234']])('%s → sin botón (null)', (_name, value) => {
    expect(organizerWhatsapp(value)).toBeNull()
  })

  it('sin VITE_ALBERTO_WHATSAPP el valor por defecto es vacío, no un número de relleno', () => {
    expect(DEMO_WHATSAPP).toBe(import.meta.env.VITE_ALBERTO_WHATSAPP ? import.meta.env.VITE_ALBERTO_WHATSAPP : '')
    expect(DEMO_WHATSAPP).not.toBe('584120000000')
  })
})

describe('guardar un evento sin WhatsApp no escribe un número de relleno', () => {
  afterEach(() => __setSupabaseClient(null))

  it('evento nuevo y evento editado quedan con organizer_whatsapp vacío', async () => {
    const { db } = await seed()
    const created = await saveEvent({ name: 'Nuevo', date_start: '2026-06-01', venue: 'X', status: 'draft', clubs: [], events: [] })
    expect(db.tables.events.find((row) => row.id === created.id).organizer_whatsapp).toBe('')
    const loaded = await getEvent('evt-1')
    await saveEvent({ ...loaded, organizer_whatsapp: '' }, false, loaded)
    expect(db.tables.events.find((row) => row.id === 'evt-1').organizer_whatsapp).toBe('')
  })
})
