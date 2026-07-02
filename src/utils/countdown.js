export function eventStartTime(dateStart) {
  if (!dateStart) return null
  const value = new Date(`${dateStart}T08:00:00`)
  return Number.isNaN(value.getTime()) ? null : value
}

export function calculateCountdown(dateStart, now = Date.now()) {
  const start = eventStartTime(dateStart)
  if (!start) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, started: false }
  const total = Math.max(0, start.getTime() - Number(now))
  return {
    total,
    days: Math.floor(total / 86400000),
    hours: Math.floor(total / 3600000) % 24,
    minutes: Math.floor(total / 60000) % 60,
    seconds: Math.floor(total / 1000) % 60,
    started: total === 0,
  }
}
