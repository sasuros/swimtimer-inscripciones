export default function WhatsAppButton({ club, athletes, inscriptions, number }) {
  const text = `Hola Alberto, acabo de enviar la inscripción de ${club.name}. ${athletes} nadadores, ${inscriptions} inscripciones.`
  return <a className="btn-primary inline-block" href={`https://wa.me/${number || '584120000000'}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Avisar por WhatsApp</a>
}
