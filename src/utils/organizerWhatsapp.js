// v1.19.2: números de ejemplo (el relleno de antes y el placeholder del editor). Nunca
// deben llegar a un botón de WhatsApp.
export const PLACEHOLDER_WHATSAPP = new Set(['584120000000', '584121234567'])

// Número listo para wa.me, o null si está vacío, no parece un teléfono o es de ejemplo.
export function organizerWhatsapp(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15 || PLACEHOLDER_WHATSAPP.has(digits)) return null
  return digits
}
