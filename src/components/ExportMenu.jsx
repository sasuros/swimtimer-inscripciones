import { Download, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export default function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false)
  return <div className="relative inline-flex"><button className="btn-primary inline-flex items-center gap-2 rounded-r-none text-sm" onClick={() => onExport('completo')}><Download className="size-4" />Descargar consolidado completo</button><button className="btn-primary rounded-l-none border-l border-white/20 px-2" aria-label="Más opciones de descarga" onClick={() => setOpen(!open)}><ChevronDown className="size-4" /></button>{open && <div className="absolute right-0 top-full z-20 mt-2 w-64 overflow-hidden rounded-lg border bg-surface shadow-card"><Option label="Consolidado principal" detail="Solo inscripciones normales" onClick={() => { onExport('principal'); setOpen(false) }} /><Option label="Suplemento tardías" detail="Solo tardías aprobadas" onClick={() => { onExport('supplement'); setOpen(false) }} /></div>}</div>
}
function Option({ label, detail, onClick }) { return <button className="block w-full border-b p-3 text-left last:border-0 hover:bg-surface-alt" onClick={onClick}><span className="block font-bold">{label}</span><span className="text-xs text-ink-muted">{detail}</span></button> }
