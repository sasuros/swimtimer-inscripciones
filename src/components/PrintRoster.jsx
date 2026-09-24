const byLastName = (roster) => [...roster].sort((a, b) => a.lastName.localeCompare(b.lastName, 'es'))

export default function PrintRoster({ title, view }) {
  const regular = byLastName(view.regularRoster)
  const late = byLastName(view.lateApprovedRoster)
  return (
    <div id="print-roster" className="hidden bg-white p-8 text-black print:block">
      <header className="mb-6 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="mt-1 text-sm">
          {view.athleteCount} nadadores · {view.resultCount} inscripciones
        </p>
      </header>
      <PrintList roster={regular} start={0} />
      {late.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 border-b border-black pb-1 text-lg font-extrabold">Tardías aprobadas</h2>
          <PrintList roster={late} start={regular.length} />
        </section>
      )}
    </div>
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
