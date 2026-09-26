// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import PreviewPlanilla from './PreviewPlanilla'
import { mount, unmountAll } from '../services/testSupport/dom.js'

// v1.19.0 — Imprimir planilla (entrenador): con 35 nadadores Chrome imprimía UNA página (se
// cortaba en el 8) y recortaba la columna Tiempo. La hoja imprimible va en <body>, fuera de
// #root (que al imprimir queda .no-print), en flujo normal y sin overflow.
const roster = Array.from({ length: 35 }, (_, i) => ({
  id: `a${i}`,
  lastName: `Apellido${i + 1}`,
  firstName: 'Nombre',
  sex: 'F',
  age: 12,
  events: [0, 1, 2].map((e) => ({ eventIndex: e, label: ['50 Libre', '100 Libre', '50 Espalda'][e], time: e === 2 ? `ULT${i + 1}` : '32.50' }))
}))
const sheet = () => document.getElementById('print-plan')
const open = () => mount(<PreviewPlanilla roster={roster} event={{ name: 'Evento' }} club={{ name: 'CAC' }} onBack={() => {}} onConfirm={() => {}} sending={false} />, { id: 'root' })

afterEach(unmountAll)

describe('Imprimir planilla', () => {
  it('la hoja es hija directa de <body>, fuera de #root; #root queda .no-print', async () => {
    await open()
    expect(sheet().parentElement).toBe(document.body)
    expect(sheet().closest('#root')).toBeNull()
    expect(document.getElementById('root').classList.contains('no-print')).toBe(true)
  })

  it('flujo normal y sin overflow ni ancho mínimo que recorten', async () => {
    await open()
    expect(sheet().style.position).toBe('static')
    expect(sheet().querySelector('.overflow-hidden, .overflow-x-auto, [class*="min-w-"]')).toBeNull()
    expect(sheet().className).toContain('print:block')
  })

  it('completa: los 35 nadadores y sus 105 renglones, hasta el último; sin botones', async () => {
    await open()
    const rows = sheet().querySelectorAll('tbody tr')
    expect(rows).toHaveLength(105)
    expect(rows[rows.length - 1].textContent).toContain('ULT35')
    expect(sheet().textContent).toContain('Apellido35')
    expect([...rows].every((row) => row.style.breakInside === 'avoid')).toBe(true)
    expect(sheet().querySelector('button')).toBeNull()
  })

  it('la pantalla no cambia: la tarjeta con la tabla y los botones siguen en #root', async () => {
    await open()
    const root = document.getElementById('root')
    expect(root.querySelectorAll('tbody tr')).toHaveLength(105)
    expect(root.textContent).toContain('Confirmar y enviar')
    expect(root.textContent).toContain('Imprimir planilla')
  })

  it('al salir de la vista previa la hoja se va y #root deja de ser .no-print', async () => {
    const { rerender } = await open()
    await act(async () => rerender(<p>formulario</p>))
    expect(sheet()).toBeNull()
    expect(document.getElementById('root').classList.contains('no-print')).toBe(false)
  })
})
