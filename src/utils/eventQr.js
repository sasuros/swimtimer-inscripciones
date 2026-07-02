import QRCode from 'qrcode'

export const PUBLIC_LANDING_URL = 'https://swimtimer-oficial.vercel.app/'

const parseDate = value => value ? new Date(`${value}T12:00:00`) : null
const day = value => new Intl.DateTimeFormat('es-VE', { day: 'numeric' }).format(value)
const month = value => new Intl.DateTimeFormat('es-VE', { month: 'long' }).format(value)

export function formatQrEventDate(startValue, endValue) {
  const start = parseDate(startValue)
  const end = parseDate(endValue)
  if (!start) return 'Fecha por confirmar'
  if (!end || startValue === endValue) return `${day(start)} de ${month(start)} de ${start.getFullYear()}`
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) return `${day(start)} y ${day(end)} de ${month(start)} de ${start.getFullYear()}`
  if (start.getFullYear() === end.getFullYear()) return `${day(start)} de ${month(start)} y ${day(end)} de ${month(end)} de ${start.getFullYear()}`
  return `${day(start)} de ${month(start)} de ${start.getFullYear()} y ${day(end)} de ${month(end)} de ${end.getFullYear()}`
}

export function qrFilename(name) {
  const safeName = String(name || 'evento').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `QR_${safeName || 'evento'}.png`
}

const loadImage = source => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('No se pudo cargar el logo de SWIMTIMER'))
  image.src = source
})

const drawCenteredLines = (ctx, text, centerX, y, maxWidth, lineHeight) => {
  const words = String(text).toUpperCase().split(/\s+/)
  const lines = []
  let line = ''
  words.forEach(word => {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word }
    else line = candidate
  })
  if (line) lines.push(line)
  lines.forEach((item, index) => ctx.fillText(item, centerX, y + index * lineHeight))
  return y + lines.length * lineHeight
}

export async function createEventQrCanvas(event) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no permite generar la imagen QR')

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#1B3A5C'
  ctx.beginPath()
  ctx.roundRect(350, 55, 380, 130, 24)
  ctx.fill()
  const logo = await loadImage('/swimtimer-logo-white.svg')
  const logoRatio = Math.min(310 / logo.naturalWidth, 90 / logo.naturalHeight)
  const logoWidth = logo.naturalWidth * logoRatio
  const logoHeight = logo.naturalHeight * logoRatio
  ctx.drawImage(logo, (1080 - logoWidth) / 2, 75 + (90 - logoHeight) / 2, logoWidth, logoHeight)

  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, PUBLIC_LANDING_URL, { width: 500, margin: 2, color: { dark: '#000000', light: '#FFFFFF' }, errorCorrectionLevel: 'H' })
  ctx.drawImage(qrCanvas, 290, 220, 500, 500)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#2C3E50'
  ctx.font = '800 50px system-ui, -apple-system, "Segoe UI", sans-serif'
  let textY = drawCenteredLines(ctx, event.name || 'Evento SWIMTIMER', 540, 770, 870, 60)

  ctx.fillStyle = '#6B7280'
  ctx.font = '500 30px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(`📅  ${formatQrEventDate(event.date_start, event.date_end)}`, 540, textY + 25)
  ctx.fillText(`📍  ${event.venue || 'Sede por confirmar'}`, 540, textY + 75)

  ctx.fillStyle = '#2C3E50'
  ctx.font = '700 36px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText('Escanea para ver', 540, textY + 160)
  ctx.fillText('series, carriles y resultados', 540, textY + 205)

  ctx.strokeStyle = '#E5E7EB'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(300, 1225)
  ctx.lineTo(780, 1225)
  ctx.stroke()
  ctx.fillStyle = '#9CA3AF'
  ctx.font = '600 25px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText('SWIMTIMER by Scanleads', 540, 1260)
  return canvas
}

export async function downloadEventQr(event) {
  const canvas = await createEventQrCanvas(event)
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo exportar la imagen QR')), 'image/png'))
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = qrFilename(event.name)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
