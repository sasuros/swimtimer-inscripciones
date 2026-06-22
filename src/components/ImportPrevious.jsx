import { Upload } from 'lucide-react'

export default function ImportPrevious({ onImport }) {
  const handleFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!Array.isArray(data.roster) && !Array.isArray(data.athletes)) throw new Error()
      onImport(data)
    } catch { window.alert('El archivo no contiene una inscripción SWIMTIMER válida.') }
    event.target.value = ''
  }
  return <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 text-sm"><Upload className="size-4" />Cargar inscripción anterior<input type="file" accept="application/json,.json" className="hidden" onChange={handleFile} /></label>
}
