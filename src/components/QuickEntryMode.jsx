import { useMemo, useRef, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { buildTemplateRows, downloadCsv, eventLabel, parseQuickEntry, safeFilename } from '../utils/quickEntry'

const EXAMPLES = [
  ['Rodriguez', 'Maria', 'F', '15/05/2013', '25m Crawl', '32.56'],
  ['Lopez', 'Carlos', 'M', '22/03/2012', '50m Espalda', '45.20'],
  ['Lopez', 'Carlos', 'M', '22/03/2012', '100m Crawl', '1:35.40'],
  ['Torres', 'Ana', 'F', '10/08/2015', '25m Pecho', '28.90']
]
const HEADERS = ['Apellido', 'Nombre', 'Sexo', 'Fecha Nac.', 'Evento', 'Tiempo']
const NOTES = [
  'Si un nadador tiene varios eventos, repítelo en varias filas (una fila por cada evento)',
  'El sexo puede ser F o M',
  'La fecha puede ser DD/MM/AAAA o AAAA-MM-DD',
  'El tiempo puede ser SS.CC o MM:SS.CC (centésimas obligatorias)',
  'Los nombres de eventos deben coincidir con los del evento: 25m Crawl, 50m Espalda, 25m Pecho, etc.',
  'Puedes copiar desde Excel o Google Sheets y pegar directamente'
]

export default function QuickEntryMode({ referenceDate, eventConfig, club, roster, onImport }) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [guideOpen, setGuideOpen] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [fileInfo, setFileInfo] = useState(null)
  const fileInput = useRef(null)
  const events = useMemo(() => (eventConfig?.events || []).filter(event => event.active !== false), [eventConfig])
  const parse = () => setParsed(parseQuickEntry(text, { referenceDate, events }))
  const validRows = parsed?.filter(row => !row.errors.length && !row.warnings.length) || []

  const loadFile = file => {
    if (!file) return
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) { setFileInfo({ error: 'Elige un archivo .csv, .txt o .tsv' }); return }
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result || '').replace(/^\uFEFF/, '')
      const rows = parseQuickEntry(content, { referenceDate, events })
      setText(content)
      setParsed(rows)
      setFileInfo({ name: file.name, count: rows.length })
    }
    reader.onerror = () => setFileInfo({ error: 'No se pudo leer el archivo seleccionado' })
    reader.readAsText(file)
  }

  const importValid = () => {
    const grouped = new Map()
    validRows.forEach(row => {
      const key = `${row.lastName}|${row.firstName}|${row.birthDate}|${row.sex}`.toLowerCase()
      if (!grouped.has(key)) grouped.set(key, { id: crypto.randomUUID(), lastName: row.lastName, firstName: row.firstName, sex: row.sex, birthDate: row.birthDate, age: row.age, category: row.category, events: [] })
      const athlete = grouped.get(key)
      if (!athlete.events.some(entry => entry.eventIndex === row.eventIndex)) athlete.events.push({ eventIndex: row.eventIndex, label: row.label, time: row.time })
    })
    const additions = [...grouped.values()].filter(item => !roster.some(old => `${old.firstName} ${old.lastName}`.toLowerCase() === `${item.firstName} ${item.lastName}`.toLowerCase()))
    onImport(additions)
    setText((parsed || []).filter(row => row.errors.length || row.warnings.length).map(row => row.rawLine).join('\n'))
    setParsed(null)
  }

  const downloadTemplate = () => {
    downloadCsv(buildTemplateRows(events, referenceDate), `plantilla_inscripcion_${safeFilename(club?.name || club?.code)}.csv`)
  }

  const downloadEvents = () => downloadCsv([
    ['Evento', 'Categoría', 'Sexo'],
    ...events.map(event => [eventLabel(event), categoryLabel(event), displaySex(event.sex)])
  ], `eventos_disponibles_${safeFilename(club?.name || club?.code)}.csv`)

  return <div className="rounded-xl border border-brand-600/30 bg-white p-4 sm:p-5">
    <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setGuideOpen(open => !open)} aria-expanded={guideOpen}>
      <span><span className="flex items-center gap-2 text-lg font-extrabold text-brand-800"><FileSpreadsheet className="size-5 text-brand-600" />Cómo preparar tu archivo de inscripción</span><span className="mt-1 block text-sm text-slate-600">Prepara un archivo Excel, Google Sheets o CSV con estos datos y pégalos aquí para inscribir a todos tus nadadores de una vez.</span></span>
      <ChevronDown className={`mt-1 size-5 shrink-0 text-brand-600 transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
    </button>

    {guideOpen && <div className="mt-5 border-t pt-5">
      <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-100 text-brand-800"><tr>{HEADERS.map(header => <th key={header} className="border px-3 py-2">{header}</th>)}</tr></thead><tbody>{EXAMPLES.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell} className="border px-3 py-2">{value}</td>)}</tr>)}</tbody></table></div>
      <div className="space-y-3 sm:hidden">{EXAMPLES.map((row, index) => <div key={index} className="rounded-lg border bg-slate-50 p-3 text-sm">{HEADERS.map((header, cell) => <p key={header} className="grid grid-cols-[92px_1fr] gap-2 py-0.5"><strong className="text-brand-800">{header}</strong><span>{row[cell]}</span></p>)}</div>)}</div>
      <ul className="mt-4 space-y-1 text-sm text-[#059669]">{NOTES.map(note => <li key={note}>• {note}</li>)}</ul>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" className="btn-secondary inline-flex items-center justify-center gap-2" onClick={downloadTemplate}><Download className="size-4" />Descargar plantilla</button><button type="button" className="btn-secondary inline-flex items-center justify-center gap-2" onClick={downloadEvents}><Download className="size-4" />Descargar lista de eventos</button></div>
    </div>}

    <div className={`mt-6 cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition ${dragging ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-slate-50'}`} onClick={() => fileInput.current?.click()} onDragEnter={event => { event.preventDefault(); setDragging(true) }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); loadFile(event.dataTransfer.files[0]) }}>
      <Upload className="mx-auto size-8 text-brand-600" />
      <p className="mt-2 font-bold text-brand-800">Arrastra tu archivo CSV aquí o haz click para seleccionar</p>
      <p className="mt-1 text-sm text-slate-500">Archivos permitidos: .csv, .txt y .tsv</p>
      <input ref={fileInput} className="hidden" type="file" accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values" onChange={event => { loadFile(event.target.files?.[0]); event.target.value = '' }} />
      <button type="button" className="btn-secondary mt-3 inline-flex items-center gap-2" onClick={event => { event.stopPropagation(); fileInput.current?.click() }}><Upload className="size-4" />Cargar archivo CSV</button>
    </div>
    {fileInfo && <p className={`mt-2 text-sm font-semibold ${fileInfo.error ? 'text-danger-700' : 'text-[#059669]'}`}>{fileInfo.error || `Archivo cargado: ${fileInfo.name} (${fileInfo.count} ${fileInfo.count === 1 ? 'fila detectada' : 'filas detectadas'})`}</p>}

    <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />O pega manualmente<span className="h-px flex-1 bg-slate-200" /></div>
    <label className="label" htmlFor="quick-entry">Pega aquí las filas de Excel, Google Sheets o CSV</label>
    <textarea id="quick-entry" className="input min-h-40 font-mono text-sm" value={text} onChange={event => { setText(event.target.value); setParsed(null) }} placeholder="Apellido | Nombre | F/M | DD/MM/AAAA | Evento | Tiempo" />
    <p className="field-help">Detectamos automáticamente tabulaciones, comas, punto y coma o barras verticales.</p>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" className="btn-secondary" onClick={parse} disabled={!text.trim()}>Validar filas</button>{validRows.length > 0 && <button type="button" className="btn-primary" onClick={importValid}>Importar {validRows.length} {validRows.length === 1 ? 'fila válida' : 'filas válidas'}</button>}</div>
    {parsed && <div className="mt-4 space-y-2 text-sm">{parsed.map(row => { const warning = row.warnings.length > 0; const invalid = row.errors.length > 0; return <div key={row.rowIndex} className={`rounded-lg px-3 py-2 ${invalid ? 'bg-danger-50 text-danger-700' : warning ? 'bg-amber-50 text-amber-700' : 'bg-success-50 text-success-800'}`}><strong>{invalid ? '❌' : warning ? '⚠️' : '✅'} Fila {row.rowIndex}: {row.lastName || '—'}, {row.firstName || '—'} — {row.label || 'sin evento'} — </strong>{invalid ? row.errors.join(' · ') : warning ? row.warnings.join(' · ') : 'OK'}</div> })}</div>}
  </div>
}

function categoryLabel(event) { return event.age_lo === event.age_hi ? `${event.age_lo}-${event.age_hi} años` : `${event.age_lo}-${event.age_hi} años` }
function displaySex(sex) { return ['X', 'B'].includes(String(sex).toUpperCase()) ? 'F/M' : String(sex || '').toUpperCase() }
