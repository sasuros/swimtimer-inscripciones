import eventData from '../data/events.json'

export function standardEventTemplate() {
  let eventPtr = 1
  return eventData.events.flatMap(event => event.ages.flatMap(([ageLo, ageHi]) => ['F', 'M'].map(sex => ({
    event_ptr: eventPtr++, distance: event.distance, style: event.style, age_lo: ageLo, age_hi: ageHi, sex, active: true
  }))))
}

export function eventRowsToWizardEvents(rows) {
  const groups = new Map()
  rows.filter(row => row.active).forEach(row => {
    const key = `${row.distance}|${row.style}|${row.sex}`
    if (!groups.has(key)) groups.set(key, { distance: row.distance, style: row.style, sex: row.sex, ages: [], eventPtrs: {} })
    const group = groups.get(key)
    group.ages.push([row.age_lo, row.age_hi])
    group.eventPtrs[`${row.age_lo}-${row.age_hi}`] = row.event_ptr
  })
  return [...groups.values()]
}
