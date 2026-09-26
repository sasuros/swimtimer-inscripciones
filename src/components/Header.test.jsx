import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Header from './Header'

// v1.19.1 — iPhone (~390 px): el bloque evento/club baja a su propia línea y, con text-right,
// el nombre del club quedaba suelto a la derecha bajo la píldora del evento.
describe('encabezado del wizard en el móvil', () => {
  const html = renderToStaticMarkup(<Header event={{ name: 'Copa Aniversario CAC 2026' }} club={{ name: 'CAC' }} />)
  const block = html.match(/<div class="([^"]*)"><span[^>]*>Copa Aniversario CAC 2026<\/span>/)?.[1].split(' ')

  it('en el móvil el bloque evento/club ocupa la línea, en columna alineada a la izquierda', () => {
    expect(block).toEqual(expect.arrayContaining(['flex', 'w-full', 'flex-col', 'items-start']))
  })

  // Solo variantes sm: que ya están en la línea base del gate de modo claro (darkMode.test.js).
  it('desde sm (escritorio) queda como antes: bloque con el ancho de su contenido y a la derecha', () => {
    expect(block).toEqual(expect.arrayContaining(['text-right', 'sm:block', 'sm:w-auto']))
    expect(html).toContain('>CAC</p>')
  })
})
