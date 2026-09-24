import { describe, expect, it } from 'vitest'
import { allLinksText, emailInvitation, whatsappInvitation } from './messageTemplates'

const event = { name: 'Copa Test', date_start: '2026-10-01', deadline: '2026-09-25', venue: 'Sede', organizer: 'Org' }
const url = 'https://ejemplo.test/inscribir?t=abc'

describe('mensajes con PIN (v1.16.0)', () => {
  it('WhatsApp y correo incluyen el código de acceso', () => {
    expect(whatsappInvitation(event, url, '1234')).toContain('Código de acceso (PIN): 1234')
    expect(emailInvitation(event, url, '1234').body).toContain('Código de acceso (PIN): 1234')
  })

  it('sin PIN no agregan la línea', () => {
    expect(whatsappInvitation(event, url)).not.toContain('PIN')
    expect(emailInvitation(event, url).body).not.toContain('PIN')
  })

  it('"Copiar todos los enlaces" lleva el PIN de cada club', () => {
    const text = allLinksText(event, [{ name: 'Club A', token: 'a', pin: '1111' }, { name: 'Club B', token: 'b', pin: '2222' }, { name: 'Sin enlace', token: null, pin: '3333' }], (token) => `u/${token}`)
    expect(text).toContain('Club A: u/a · PIN: 1111')
    expect(text).toContain('Club B: u/b · PIN: 2222')
    expect(text).not.toContain('3333')
  })
})
