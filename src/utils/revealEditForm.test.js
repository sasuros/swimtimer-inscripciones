import { describe, expect, it, vi } from 'vitest'
import { revealEditForm } from './revealEditForm'

const element = () => ({ scrollIntoView: vi.fn() })
const win = reduce => ({ matchMedia: vi.fn(() => ({ matches: reduce })) })

describe('revealEditForm', () => {
  it('lleva el formulario a la vista con scroll suave, alineado arriba', () => {
    const form = element()
    expect(revealEditForm(form, win(false))).toBe(true)
    expect(form.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('respeta "reducir movimiento" del sistema', () => {
    const form = element()
    revealEditForm(form, win(true))
    expect(form.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
  })

  it('funciona sin matchMedia y no falla sin elemento', () => {
    const form = element()
    expect(revealEditForm(form, {})).toBe(true)
    expect(form.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(revealEditForm(null, win(false))).toBe(false)
    expect(revealEditForm({}, win(false))).toBe(false)
  })
})
