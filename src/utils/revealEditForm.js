// Lleva el formulario a la vista cuando el entrenador toca ✏️ en un nadador.
// En pantallas chicas el formulario queda debajo de la lista y, sin esto, parece que no pasó nada.
export function revealEditForm(element, win = globalThis.window) {
  if (!element?.scrollIntoView) return false
  const reduceMotion = Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  return true
}
