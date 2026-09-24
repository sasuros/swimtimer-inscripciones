import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AthleteForm from './AthleteForm'

const athlete = { id: 'a1', lastName: 'Pérez', firstName: 'Ana', sex: 'F', birthDate: '2014-03-10', events: [] }
const render = editing => renderToStaticMarkup(<AthleteForm roster={editing ? [athlete] : []} referenceDate="2026-12-31" eventConfig={{ events: [] }} editing={editing} onSave={() => {}} onCancelEdit={() => {}} />)

describe('AthleteForm: señal de edición', () => {
  it('en modo edición muestra "Editando a <nombre>", botón Cancelar y el formulario resaltado', () => {
    const html = render(athlete)
    expect(html).toContain('Editando a Ana Pérez')
    expect(html).toContain('role="status"')
    expect(html).toContain('data-editing="true"')
    expect(html).toContain('ring-2')
    expect(html).toContain('Guardar cambios')
    expect(html).toContain('Cancelar')
  })

  it('en modo alta no muestra la señal de edición', () => {
    const html = render(null)
    expect(html).toContain('Inscribir nadador #1')
    expect(html).not.toContain('Editando a')
    expect(html).not.toContain('data-editing')
    expect(html).not.toContain('ring-2')
  })
})
