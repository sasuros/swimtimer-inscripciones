import { useEffect } from 'react'
import { createPortal } from 'react-dom'

const byLastName = (roster) => [...roster].sort((a, b) => a.lastName.localeCompare(b.lastName, 'es'))

// v1.18.0: la hoja se monta directo en <body> (portal), fuera del modal `fixed inset-0
// overflow-y-auto`: dentro de él, el navegador la imprimía recortada al alto de una hoja y
// repetida en cada página, con tantas páginas como medía el tablero oculto. Mientras está
// montada, #root lleva .no-print (display:none al imprimir): solo queda la hoja, en flujo
// normal (position static en línea gana a `#print-roster { position: absolute }`) y paginada.
export default function PrintRoster({ title, view }) {
  const regular = byLastName(view.regularRoster)
  const late = byLastName(view.lateApprovedRoster)
  useEffect(() => {
    const root = document.getElementById('root')
    root?.classList.add('no-print')
    return () => root?.classList.remove('no-print')
  }, [])
  return createPortal(
    <div id="print-roster" className="hidden bg-white p-8 text-black print:block" style={{ position: 'static' }}>
      <header className="mb-6 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="mt-1 text-sm">
          {view.athleteCount} nadadores · {view.resultCount} inscripciones
        </p>
      </header>
      <PrintList roster={regular} start={0} />
      {late.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 border-b border-black pb-1 text-lg font-extrabold" style={{ breakAfter: 'avoid' }}>
            Tardías aprobadas
          </h2>
          <PrintList roster={late} start={regular.length} />
        </section>
      )}
    </div>,
    document.body
  )
}

function PrintList({ roster, start }) {
  return (
    <div className="space-y-3">
      {roster.map((athlete, index) => (
        <div key={athlete.id} className="flex gap-3 border-b border-slate-300 pb-2" style={{ breakInside: 'avoid' }}>
          <span className="w-8 shrink-0 font-bold">{start + index + 1}.</span>
          <div>
            <p className="font-bold">
              {athlete.lastName}, {athlete.firstName} · {athlete.sex} · {athlete.category?.label || `${athlete.age} años`}
            </p>
            <p className="mt-1 text-sm">{athlete.events.map((item) => `${item.label}: ${item.time}`).join(' · ')}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
