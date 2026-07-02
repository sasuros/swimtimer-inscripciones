import { describe, expect, it } from 'vitest'
import handler from '../../api/og-image'

describe('imagen Open Graph', () => {
  it('genera un SVG seguro con el estado en vivo', async () => {
    const response = handler(new Request('https://swimtimer-oficial.vercel.app/api/og-image?title=Copa%20%3C68%3E&date=18%20de%20junio&venue=Centro%20Portugu%C3%A9s&status=live'))
    const svg = await response.text()

    expect(response.headers.get('content-type')).toContain('image/svg+xml')
    expect(svg).toContain('Copa &lt;68&gt;')
    expect(svg).toContain('EN VIVO')
    expect(svg).not.toContain('Copa <68>')
  })
})
