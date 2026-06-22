export default function EventSelector({ events, selected, onToggle }) {
  return <section><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">2. Selección de eventos</h3><span className="text-sm font-semibold text-brand-800">{selected.length} de 8 seleccionados</span></div>
    <div className="grid gap-2 sm:grid-cols-2">{events.map(event => {
      const active = selected.includes(event.eventIndex)
      return <button key={event.eventIndex} type="button" onClick={() => onToggle(event.eventIndex)} disabled={!active && selected.length >= 8} className={`rounded-xl border p-3 text-left transition ${active ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600' : 'bg-white hover:border-brand-600 disabled:opacity-40'}`}>
        <strong>{event.label}</strong><span className="mt-1 block text-xs">Categoría disponible</span>
      </button>
    })}</div>
  </section>
}
