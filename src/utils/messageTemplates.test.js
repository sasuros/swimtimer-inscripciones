import { describe, expect, it } from 'vitest'
import { REOPEN_LINE, allLinksText, clubLinkText, emailInvitation, whatsappInvitation } from './messageTemplates'
import LinkDistributionModal from '../components/LinkDistributionModal'

const event = { name: 'Copa Test', date_start: '2026-10-01', deadline: '2026-09-25', venue: 'Sede', organizer: 'Org' }
const url = 'https://ejemplo.test/inscribir?t=abc'

describe('mensajes con PIN (v1.16.0)', () => {
  it('WhatsApp y correo incluyen el código de acceso', () => {
    expect(whatsappInvitation(event, url, '1234')).toContain('Código de acceso (PIN): 1234')
    expect(emailInvitation(event, url, '1234').body).toContain('Código de acceso (PIN): 1234')
  })

  it('WhatsApp y correo recuerdan que el enlace sirve para volver (v1.19.1)', () => {
    const line = 'Puedes volver a abrir este enlace cuando quieras para agregar o corregir nadadores.'
    expect(REOPEN_LINE).toBe(line)
    expect(whatsappInvitation(event, url, '1234')).toContain(`Código de acceso (PIN): 1234\n\n${line}\n\nFecha límite`)
    expect(emailInvitation(event, url, '1234').body).toContain(`Código de acceso (PIN): 1234\n\n${line}\n\nFecha del evento`)
    expect(whatsappInvitation(event, url)).toContain(`${url}\n\n${line}\n\n`)
    expect(emailInvitation(event, url).body).toContain(`${url}\n\n${line}\n\n`)
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

describe('"Copiar enlace" de un club copia URL + PIN (v1.16.0)', () => {
  it('mismo formato que cada línea de "Copiar todos"', () => {
    const club = { name: 'Club A', token: 'a', pin: '1111' }
    expect(clubLinkText(club, 'u/a')).toBe('Club A: u/a · PIN: 1111')
    expect(allLinksText(event, [club], (token) => `u/${token}`).split('\n').at(-1)).toBe(clubLinkText(club, 'u/a'))
  })

  it('sin PIN copia solo nombre y URL', () => {
    expect(clubLinkText({ name: 'Club A' }, 'u/a')).toBe('Club A: u/a')
  })

  it('el botón del modal de distribución copia el texto con PIN', () => {
    const copies = []
    const tree = LinkDistributionModal({ event, eventId: 'evt-1', clubs: [{ code: 5, name: 'Club A', token: 'a', pin: '1111', email: '' }], urlFor: (token) => `u/${token}`, onCopy: (...args) => copies.push(args), onSendEmail: () => {}, emailing: false, onClose: () => {} })
    const find = (node) => {
      if (!node || typeof node !== 'object') return null
      if (Array.isArray(node)) return node.map(find).find(Boolean) || null
      const children = [node.props?.children].flat()
      if (node.type === 'button' && children.includes('Copiar enlace')) return node
      return find(node.props?.children)
    }
    find(tree).props.onClick()
    expect(copies).toEqual([['Club A: u/a · PIN: 1111', 'Enlace y PIN copiados']])
  })
})
