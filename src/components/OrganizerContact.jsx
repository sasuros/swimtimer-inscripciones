import { Mail, MessageCircle } from 'lucide-react'
import { organizerWhatsapp } from '../utils/organizerWhatsapp'

// v1.19.2: botones de contacto de las pantallas sin acceso al formulario. WhatsApp solo
// con un número real (ni vacío ni de ejemplo); el correo se muestra siempre.
export default function OrganizerContact({ whatsapp, email, subject, message }) {
  const number = organizerWhatsapp(whatsapp)
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {number && (
        <a className="btn-primary inline-flex items-center gap-2" href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
          <MessageCircle className="size-4" />
          Contactar por WhatsApp
        </a>
      )}
      <a className="btn-secondary inline-flex items-center gap-2" href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}>
        <Mail className="size-4" />
        Enviar correo
      </a>
    </div>
  )
}
