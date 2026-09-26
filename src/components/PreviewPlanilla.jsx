import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Logo from './Logo'

// v1.19.0: la planilla que se imprime es una copia montada directo en <body> (portal), en flujo
// normal y sin los overflow de la tarjeta de pantalla: dentro de #root, con
// `#print-plan { position: absolute }` + `overflow-hidden`, Chrome imprimía UNA sola página
// (35 nadadores → se cortaba en el 8) y recortaba la columna Tiempo. Mientras está montada,
// #root lleva .no-print (display:none al imprimir). Mismo arreglo que PrintRoster (v1.18.0).
export default function PreviewPlanilla({ roster, event, club, onBack, onConfirm, sending }) {
  useEffect(() => {
    const root = document.getElementById('root')
    root?.classList.add('no-print')
    return () => root?.classList.remove('no-print')
  }, [])
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="card overflow-hidden bg-white p-5 sm:p-8">
        <PlanillaSheet roster={roster} event={event} club={club} />
      </div>
      <div className="no-print mt-5 flex flex-wrap justify-end gap-2">
        <button className="btn-secondary" onClick={onBack}>
          Volver y editar
        </button>
        <button className="btn-secondary" onClick={() => window.print()}>
          Imprimir planilla
        </button>
        <button className="btn-primary" onClick={onConfirm} disabled={sending}>
          {sending ? 'Enviando…' : 'Confirmar y enviar'}
        </button>
      </div>
      {createPortal(
        <div id="print-plan" className="hidden bg-white p-8 text-black print:block" style={{ position: 'static' }}>
          <PlanillaSheet roster={roster} event={event} club={club} print />
        </div>,
        document.body
      )}
    </main>
  )
}

function PlanillaSheet({ roster, event, club, print = false }) {
  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">Planilla de inscripción</h1>
          <p>{event.name}</p>
          <p className="font-semibold">{club.name}</p>
        </div>
        <Logo className="size-20" variant="color" />
      </div>
      <div className={print ? '' : 'overflow-x-auto'}>
        <table className={`w-full border-collapse text-left text-sm ${print ? '' : 'min-w-[700px]'}`}>
          <thead>
            <tr className="bg-brand-50 text-brand-800">
              {['#', 'Apellido', 'Nombre', 'Sexo', 'Edad', 'Evento', 'Tiempo'].map((label) => (
                <th key={label} className="border p-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.flatMap((athlete, athleteIndex) =>
              athlete.events.map((eventItem, eventIndex) => (
                <tr key={`${athlete.id}-${eventItem.eventIndex}`} style={{ breakInside: 'avoid' }}>
                  <td className="border p-2">{eventIndex ? '' : athleteIndex + 1}</td>
                  <td className="border p-2">{eventIndex ? '' : athlete.lastName}</td>
                  <td className="border p-2">{eventIndex ? '' : athlete.firstName}</td>
                  <td className="border p-2">{eventIndex ? '' : athlete.sex}</td>
                  <td className="border p-2">{eventIndex ? '' : athlete.age}</td>
                  <td className="border p-2">{eventItem.label}</td>
                  <td className="border p-2 font-mono">{eventItem.time}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
