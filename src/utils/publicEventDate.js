const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const parts = value => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return { year, month, day }
}

export function formatPublicEventDate(startValue, endValue) {
  const start = parts(startValue)
  if (!start.year || !start.month || !start.day) return 'Fecha por confirmar'
  const end = parts(endValue)
  if (!end.year || !end.month || !end.day || startValue === endValue) return `${start.day} de ${MONTHS[start.month - 1]} de ${start.year}`
  if (start.year === end.year && start.month === end.month) return `${start.day} y ${end.day} de ${MONTHS[start.month - 1]} de ${start.year}`
  if (start.year === end.year) return `${start.day} de ${MONTHS[start.month - 1]} y ${end.day} de ${MONTHS[end.month - 1]} de ${start.year}`
  return `${start.day} de ${MONTHS[start.month - 1]} de ${start.year} al ${end.day} de ${MONTHS[end.month - 1]} de ${end.year}`
}
