export const config = { runtime: 'edge' }

const escapeXml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

export default function handler(request) {
  const { searchParams } = new URL(request.url)
  const title = escapeXml(searchParams.get('title') || 'SWIMTIMER')
  const date = escapeXml(searchParams.get('date'))
  const venue = escapeXml(searchParams.get('venue'))
  const status = searchParams.get('status') || ''
  const details = [date, venue].filter(Boolean).join(' · ')
  const statusMarkup = status === 'live' ? '<circle cx="520" cy="470" r="8" fill="#22c55e"/><text x="540" y="478" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#22c55e">EN VIVO</text>' : ''
  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#1B3A5C"/>
    <path d="M0 545 Q200 485 400 545 T800 545 T1200 545 V630 H0Z" fill="#244b70" opacity=".7"/>
    <text x="600" y="180" text-anchor="middle" font-family="system-ui, sans-serif" font-size="72" font-weight="900" fill="#FFFFFF">SWIMTIMER</text>
    <text x="600" y="225" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#8BAAC4" letter-spacing="3">by Scanleads</text>
    <text x="600" y="340" text-anchor="middle" font-family="system-ui, sans-serif" font-size="36" font-weight="700" fill="#FFFFFF">${title}</text>
    <text x="600" y="400" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" fill="#8BAAC4">${details}</text>
    ${statusMarkup}
    <text x="600" y="570" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="#A8BDD0">Series · Carriles · Resultados oficiales</text>
  </svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
