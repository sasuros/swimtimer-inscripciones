import { useCallback, useEffect, useState } from 'react'
import { ADD_FEEDBACK_MS } from '../utils/addFeedback'

// v1.21.1 — Aviso de confirmación y resaltado en la lista tras agregar o editar nadadores.
// El aviso NO se borra al escribir: se reemplaza con el siguiente, desaparece a los 8 s o al
// tocar "Editar" / "Cambiar método" (dismiss). El resaltado dura lo mismo. Nunca mueve la pantalla.
export default function useAddFeedback() {
  const [notice, setNotice] = useState(null) // { kind: 'success' | 'warning', text }
  const [highlightIds, setHighlightIds] = useState([])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(null), ADD_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!highlightIds.length) return undefined
    const timer = setTimeout(() => setHighlightIds([]), ADD_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [highlightIds])

  // Cada aviso es un objeto nuevo: reinicia los 8 s aunque el texto se repita.
  const show = useCallback((next, ids = []) => {
    setNotice({ kind: next.kind || 'success', text: next.text })
    if (ids.length) setHighlightIds([...ids])
  }, [])
  const dismiss = useCallback(() => setNotice(null), [])

  return { notice, highlightIds, show, dismiss }
}
