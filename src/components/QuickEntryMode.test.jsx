import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import QuickEntryMode, { EXCEL_FILE_TEXT, fileProblem } from './QuickEntryMode'

// v1.20.0 — guía del modo experto y archivos de Excel.
describe('archivo elegido', () => {
  it.each(['Inscripcion.xlsx', 'club.XLS', 'datos.xlsm', 'hoja.ods', 'lista.numbers'])('%s: se explica cómo guardarlo como CSV', (name) => {
    expect(fileProblem(name)).toBe(EXCEL_FILE_TEXT)
    expect(EXCEL_FILE_TEXT).toContain('Guárdalo como CSV')
  })

  it.each(['club.csv', 'CLUB.CSV', 'lista.txt', 'lista.tsv'])('%s: se acepta', (name) => {
    expect(fileProblem(name)).toBe('')
  })

  it('otro tipo: el mensaje de siempre', () => {
    expect(fileProblem('foto.png')).toBe('Elige un archivo .csv, .txt o .tsv')
  })
})

describe('guía en pantalla', () => {
  it('cuenta lo que ahora se acepta', () => {
    const html = renderToStaticMarkup(<QuickEntryMode referenceDate="2026-10-17" eventConfig={{ events: [] }} club={{ name: 'CAC' }} roster={[]} onImport={() => {}} />)
    for (const text of ['Femenino, Mujer, Masculino, Hombre o H', 'escribe NT', 'con punto o coma', '25 Libre', 'en cualquier orden', 'guárdalo antes como CSV']) expect(html).toContain(text)
    expect(html).toContain('accept=".csv,.txt,.tsv,.xlsx,.xls,')
  })
})
