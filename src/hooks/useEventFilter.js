import eventData from '../data/events.json'

export default function useEventFilter(category, sex, eventConfig) {
  if (!category || !sex) return []
  if (Array.isArray(eventConfig?.events)) {
    return eventConfig.events.filter(event => event.active && event.sex === sex && event.age_lo === category.min && event.age_hi === category.max)
      .map(event => ({ ...event, eventIndex: event.event_ptr, label: `${event.distance}m ${event.style}` }))
  }
  return eventData.events.map((event, eventIndex) => ({ ...event, eventIndex, label: `${event.distance}m ${event.style}` }))
    .filter(event => event.ages.some(([min, max]) => min === category.min && max === category.max))
}
