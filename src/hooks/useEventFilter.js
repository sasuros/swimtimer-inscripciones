import eventData from '../data/events.json'

export default function useEventFilter(category) {
  if (!category) return []
  return eventData.events.map((event, eventIndex) => ({ ...event, eventIndex, label: `${event.distance}m ${event.style}` }))
    .filter(event => event.ages.some(([min, max]) => min === category.min && max === category.max))
}
