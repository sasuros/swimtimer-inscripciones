import { useState } from 'react'
import { FileJson, Upload } from 'lucide-react'
import AdminHeader from '../components/AdminHeader'
import { saveEvent } from '../services/api'
import { parseMeetManagerConfig, summarizeImportedEvents } from '../utils/meetManagerImport'

export default function ImportMeetManager() {
  const [event, setEvent] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [expanded, setExpanded] = useState({ clubs: false, events: false })
  const loadFile = async file => {
    if (!file) return
    try { setEvent(parseMeetManagerConfig(await file.text())); setError('') }
    catch (failure) { setEvent(null); setError(failure instanceof SyntaxError ? 'El archivo no contiene JSON válido' : failure.message) }
  }
  const importEvent = async () => {
    const saved = await saveEvent(event, false)
    window.location.href = `/admin/eventos/${saved.id}/editar?imported=1`
  }
  const eventGroups = event ? summarizeImportedEvents(event.events) : []

  return <><AdminHeader><a href="/admin/eventos" className="btn-secondary text-sm">Cancelar</a></AdminHeader>
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div><p className="text-sm font-bold uppercase tracking-[.2em] text-brand-fg">Meet Manager 2.0</p><h1 className="mt-1 text-3xl font-extrabold text-ink-strong">Importar configuración</h1><p className="mt-2 text-ink-muted">Meet Manager será la fuente de verdad para clubes, pruebas y datos del evento.</p></div>
      {error && <p className="rounded-lg bg-danger-bg p-4 text-danger-fg">{error}</p>}
      {!event ? <label
        onDragEnter={e => { e.preventDefault(); setDragging(true) }}
        onDragOver={e => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]) }}
        className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-surface-muted p-8 text-center shadow-sm transition ${dragging ? 'border-brand-fg bg-brand-bg' : 'border-line-strong'}`}
      >
        <Upload className="size-12 text-brand-fg" />
        <h2 className="mt-4 text-xl font-bold text-ink-strong">Arrastra aquí el archivo de configuración</h2>
        <p className="mt-2 text-ink-muted">Archivo .json generado desde Meet Manager</p>
        <span className="btn-primary mt-5">Elegir archivo</span>
        <input type="file" accept="application/json,.json" className="hidden" onChange={e => loadFile(e.target.files?.[0])} />
      </label> : <section className="card p-5 sm:p-7">
        <div className="flex items-center gap-3"><FileJson className="size-10 text-brand-fg" /><div><p className="text-sm text-ink-muted">Importación desde Meet Manager</p><h2 className="text-2xl font-extrabold text-ink-strong">{event.name}</h2></div></div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2"><Summary label="Fecha" value={event.date_start} /><Summary label="Sede" value={event.venue || 'Por completar'} /><Summary label="Clubes" value={event.clubs.length} /><Summary label="Pruebas activas" value={event.events.length} /></dl>
        <div className="mt-6 grid gap-4 md:grid-cols-2"><ImportList title="Clubes" expanded={expanded.clubs} onToggle={() => setExpanded({ ...expanded, clubs: !expanded.clubs })} items={event.clubs.map(club => `${club.name} (#${club.code})`)} /><ImportList title="Pruebas" expanded={expanded.events} onToggle={() => setExpanded({ ...expanded, events: !expanded.events })} items={eventGroups.map(group => `${group.label} (${group.categories} categorías)`)} /></div>
        <div className="mt-7 flex flex-wrap justify-end gap-2"><button className="btn-secondary" onClick={() => setEvent(null)}>Elegir otro archivo</button><button className="btn-primary" onClick={importEvent}>Importar y crear evento</button></div>
      </section>}
    </main>
  </>
}

function Summary({ label, value }) { return <div className="rounded-lg border bg-surface-muted p-4"><dt className="text-sm text-ink-muted">✓ {label}</dt><dd className="mt-1 text-lg font-bold text-success-fg">{value}</dd></div> }
function ImportList({ title, items, expanded, onToggle }) { const shown = expanded ? items : items.slice(0, 4); return <div className="rounded-lg border p-4"><h3 className="font-bold text-ink-strong">{title}</h3><ul className="mt-3 space-y-1 text-sm">{shown.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>{items.length > 4 && <button className="mt-3 text-sm font-bold text-brand-fg" onClick={onToggle}>{expanded ? 'Ver menos' : `Ver todos (${items.length})`}</button>}</div> }
