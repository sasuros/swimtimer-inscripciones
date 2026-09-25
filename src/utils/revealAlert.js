// v1.18.0: lleva a la vista un aviso que aparece arriba (conflicto, tardía revisada,
// página vieja) y le pasa el foco. En el iPhone el entrenador envía desde abajo y, sin
// esto, parece que no pasó nada. Mismo patrón que revealEditForm (v1.8.2).
export function revealAlert(element, win = globalThis.window) {
  if (!element?.scrollIntoView) return false
  const reduceMotion = Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  element.focus?.({ preventScroll: true })
  return true
}
