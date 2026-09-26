import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AlreadySubmittedNotice, ConflictPanel, LateRegularNotice, revealOnMount } from './WizardNotices'
import { revealAlert } from '../utils/revealAlert'
import { CONFLICT_TEXT, LATE_DECIDED_TEXT, STALE_CLIENT_TEXT } from '../services/concurrency'

const element = () => ({ scrollIntoView: vi.fn(), focus: vi.fn() })
const win = (reduce) => ({ matchMedia: () => ({ matches: reduce }) })
const GREEN = 'Tus nadadores ya están cargados abajo'

describe('panel de conflicto: scroll y foco (v1.18.0)', () => {
  it('revealAlert lleva el panel a la vista y le pasa el foco sin un segundo salto', () => {
    const panel = element()
    expect(revealAlert(panel, win(false))).toBe(true)
    expect(panel.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(panel.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('con movimiento reducido el scroll es instantáneo', () => {
    const panel = element()
    revealAlert(panel, win(true))
    expect(panel.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
  })

  it('el panel se revela al montarse (ref) y no hace nada al desmontarse', () => {
    const panel = element()
    revealOnMount(panel)
    expect(panel.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(panel.focus).toHaveBeenCalledTimes(1)
    expect(() => revealOnMount(null)).not.toThrow()
  })

  it.each([
    ['conflicto', { text: CONFLICT_TEXT, reload: 'Cargar la versión más reciente' }],
    ['tardía revisada', { text: LATE_DECIDED_TEXT }],
    ['página vieja', { text: STALE_CLIENT_TEXT, reload: 'Recargar la página' }]
  ])('%s: role="alert" y enfocable (tabindex -1)', (_name, conflict) => {
    const html = renderToStaticMarkup(<ConflictPanel conflict={conflict} onReload={() => {}} />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain(conflict.text)
    if (conflict.reload) expect(html).toContain(conflict.reload)
  })
})

describe('avisos de "ya enviaste" frente a los paneles nuevos', () => {
  const render = (props) => renderToStaticMarkup(<AlreadySubmittedNotice isLate={false} alreadySubmitted rosterCount={3} conflict={null} lateDecided={false} {...props} />)

  it('sin conflicto se muestra el banner verde', () => {
    expect(render()).toContain(GREEN)
  })

  it.each([
    ['conflicto', { text: CONFLICT_TEXT }],
    ['página vieja', { text: STALE_CLIENT_TEXT }],
    ['tardía revisada', { text: LATE_DECIDED_TEXT }]
  ])('con el panel de %s activo no se muestra ningún aviso de "vuelve a enviar"', (_name, conflict) => {
    expect(render({ conflict })).toBe('')
    expect(render({ conflict, rosterCount: 0 })).toBe('')
    expect(render({ conflict, isLate: true })).toBe('')
  })

  it('una tardía ya revisada (D1) tampoco invita a volver a enviar', () => {
    expect(render({ isLate: true, lateDecided: true })).toBe('')
    expect(render({ isLate: true })).toContain('Ya enviaste una inscripción tardía')
  })
})

describe('tardías: aviso de la inscripción regular frente al panel de conflicto (v1.19.1)', () => {
  const REGULAR = 'Ya enviaste tu inscripción regular con 12 nadadores.'
  const ADD = 'Agrega abajo a quienes quieras inscribir por la vía tardía.'
  const render = (props) => renderToStaticMarkup(<LateRegularNotice isLate lockedCount={12} conflict={null} lateDecided={false} {...props} />)

  it('sin conflicto se muestra e invita a agregar nadadores', () => {
    expect(render()).toContain(REGULAR)
    expect(render()).toContain(ADD)
  })

  it.each([
    ['conflicto', { text: CONFLICT_TEXT }],
    ['página vieja', { text: STALE_CLIENT_TEXT }],
    ['tardía revisada', { text: LATE_DECIDED_TEXT }]
  ])('con el panel de %s activo no se muestra', (_name, conflict) => {
    expect(render({ conflict })).toBe('')
    expect(render({ conflict, lateDecided: true })).toBe('')
  })

  it('con la tardía ya revisada (D1) se muestra sin invitar a agregar', () => {
    expect(render({ lateDecided: true })).toContain(REGULAR)
    expect(render({ lateDecided: true })).not.toContain(ADD)
  })

  it('singular, y nada fuera de tardías o sin inscripción regular', () => {
    expect(render({ lockedCount: 1 })).toContain('con 1 nadador.')
    expect(render({ isLate: false })).toBe('')
    expect(render({ lockedCount: 0 })).toBe('')
  })
})
