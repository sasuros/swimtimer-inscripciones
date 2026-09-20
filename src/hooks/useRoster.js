import { useEffect, useState } from 'react'

export default function useRoster(token, initial = []) {
  const key = `swimtimer-roster:${token}`
  const [roster, setRoster] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key))
      return Array.isArray(stored) && stored.length ? stored : initial
    } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(roster)) }, [key, roster])
  return [roster, setRoster]
}
