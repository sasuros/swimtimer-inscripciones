export default function PrintRoster({ inscription }) {
  const sorted = [...(inscription.roster || [])].sort((a, b) => a.lastName.localeCompare(b.lastName, 'es'))
  return (
    <div id="print-roster" className="hidden bg-white p-8 text-black print:block">
      <header className="mb-6 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-extrabold">{inscription.meta.club_name}</h1>
        <p className="mt-1 text-sm">
          {inscription.athletes.length} nadadores · {inscription.results.length} inscripciones
        </p>
      </header>
      <div className="space-y-3">
        {sorted.map((athlete, index) => (
          <div key={athlete.id} className="flex gap-3 border-b border-slate-300 pb-2" style={{ breakInside: 'avoid' }}>
            <span className="w-8 shrink-0 font-bold">{index + 1}.</span>
            <div>
              <p className="font-bold">
                {athlete.lastName}, {athlete.firstName} · {athlete.sex} · {athlete.category?.label || `${athlete.age} años`}
              </p>
              <p className="mt-1 text-sm">{athlete.events.map((item) => `${item.label}: ${item.time}`).join(' · ')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
