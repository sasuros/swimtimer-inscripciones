export default function WhatsAppButton({ club, athletes, inscriptions, number, external = false }) {
  const text = external
    ? `Hola Alberto, envío la inscripción de ${club.name}: ${athletes} nadadores y ${inscriptions} inscripciones. Adjunto el archivo JSON descargado desde SWIMTIMER.`
    : `Hola Alberto, acabo de enviar la inscripción de ${club.name}. ${athletes} nadadores, ${inscriptions} inscripciones.`
  return <a className="btn-primary inline-block" href={`https://wa.me/${number || '584120000000'}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">{external ? 'Enviar por WhatsApp' : 'Avisar por WhatsApp'}</a>
}
