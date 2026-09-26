import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { compileCss, resolvedRules } from '../../scripts/lightCss.mjs'
import AthleteForm from '../components/AthleteForm'

// v1.19.0 — "Fecha de nacimiento" en iOS Safari se salía del borde derecho de la tarjeta.
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const rulesFor = async (raw) => {
  const rules = resolvedRules(await compileCss({ content: [{ raw }] }))
  return Object.fromEntries(Object.entries(rules).map(([key, value]) => [key.replaceAll('\\', ''), value]))
}
const decls = (rule) => JSON.stringify(rule)

describe('input de fecha del wizard: mismo ancho que los demás campos', () => {
  it('.input-date: min-width 0, max-width 100%, border-box, sin apariencia nativa y alto de .input', async () => {
    const rules = await rulesFor('input input-date')
    const css = decls(rules['.input-date'])
    for (const expected of ['min-width', 'max-width', 'box-sizing', 'appearance', 'min-height']) expect(css).toContain(expected)
    expect(css).toMatch(/min-width[^,]*0/)
    expect(css).toMatch(/max-width[^,]*100%/)
    expect(css).toMatch(/border-box/)
    expect(css).toMatch(/none/)
    expect(css).toMatch(/2\.875rem/)
    expect(decls(rules['.input'])).toMatch(/width[^,]*100%/) // el ancho sigue saliendo de .input (w-full)
    expect(Object.keys(rules).some((key) => key.includes('.input-date::-webkit-date-and-time-value'))).toBe(true)
  }, 30000)

  it('el campo "Fecha de nacimiento" lleva .input + .input-date (y .input-error sigue funcionando)', () => {
    const html = renderToStaticMarkup(createElement(AthleteForm, { roster: [], referenceDate: '2026-12-31', eventConfig: { events: [] }, onSave: () => {}, onCancelEdit: () => {} }))
    const input = html.match(/<input[^>]*id="birthDate"[^>]*>/)[0]
    expect(input).toContain('type="date"')
    expect(input).toMatch(/class="input [^"]*input-date"/)
  })

  it('los inputs de fecha del editor del admin no cambian (siguen solo con .input)', () => {
    const editor = read('src/pages/EventEditor.jsx')
    expect(editor).not.toContain('input-date')
    expect((editor.match(/type="date"/g) || []).length).toBe(3)
  })

  it('modo oscuro: el campo sigue siendo .input, así que hereda color-scheme dark', () => {
    expect(read('src/index.css')).toContain('[data-theme="dark"] .input { color-scheme: dark; }')
  })
})
