import { useEffect, useState } from 'react'

export default function useRoster(token, initial = []) {
  const key = `swimtimer-roster:${token}`
  const [roster, setRoster] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) || initial } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(roster)) }, [key, roster])
  return [roster, setRoster]
}
