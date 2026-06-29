import { Download, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export default function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false)
  return <div className="relative"><button className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={() => setOpen(!open)}><Download className="size-4" />Descargar JSON <ChevronDown className="size-3" /></button>{open && <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-lg border bg-white shadow-card"><Option label="Consolidado principal" detail="Solo inscripciones normales" onClick={() => { onExport('principal'); setOpen(false) }} /><Option label="Consolidado completo" detail="Normales + tardías aprobadas" onClick={() => { onExport('completo'); setOpen(false) }} /><Option label="Suplemento tardías" detail="Solo tardías aprobadas" onClick={() => { onExport('supplement'); setOpen(false) }} /></div>}</div>
}
function Option({ label, detail, onClick }) { return <button className="block w-full border-b p-3 text-left last:border-0 hover:bg-slate-100" onClick={onClick}><span className="block font-bold">{label}</span><span className="text-xs text-slate-500">{detail}</span></button> }
