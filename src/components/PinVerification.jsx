import { useEffect, useRef, useState } from 'react'
import Header from './Header'
import { verifyAccessPin } from '../services/api'

const MAX_ATTEMPTS = 5
const LOCK_MS = 5 * 60 * 1000

export default function PinVerification({ token, access, onVerified }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const inputs = useRef([])
  const storageKey = `swimtimer-pin-attempts:${access.eventId}:${access.club.code}`
  const initial = readAttempts(storageKey)
  const [attempts, setAttempts] = useState(initial.attempts)
  const [lockedUntil, setLockedUntil] = useState(initial.lockedUntil)
  const [now, setNow] = useState(Date.now())
  const locked = lockedUntil > now
  useEffect(() => {
    if (!locked) return undefined
    const timeout = window.setTimeout(
      () => {
        setNow(Date.now())
        setError('')
      },
      Math.max(0, lockedUntil - Date.now()) + 50
    )
    return () => window.clearTimeout(timeout)
  }, [locked, lockedUntil])

  const changeDigit = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    setDigits((current) => current.map((item, position) => (position === index ? digit : item)))
    setError('')
    if (digit && index < 3) inputs.current[index + 1]?.focus()
  }
  const paste = (event) => {
    const value = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!value) return
    event.preventDefault()
    setDigits(Array.from({ length: 4 }, (_, index) => value[index] || ''))
    inputs.current[Math.min(value.length, 4) - 1]?.focus()
  }
  const verify = async (event) => {
    event.preventDefault()
    if (locked || digits.some((digit) => !digit)) return
    setChecking(true)
    try {
      const result = await verifyAccessPin(token, digits.join(''))
      if (result.valid) {
        localStorage.removeItem(storageKey)
        sessionStorage.setItem(`swimtimer-pin-verified:${access.eventId}:${access.club.code}`, '1')
        onVerified()
        return
      }
      const next = attempts + 1
      if (next >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCK_MS
        localStorage.setItem(storageKey, JSON.stringify({ attempts: 0, lockedUntil: until }))
        setAttempts(0)
        setLockedUntil(until)
        setError('Demasiados intentos. Intenta nuevamente en 5 minutos.')
      } else {
        localStorage.setItem(storageKey, JSON.stringify({ attempts: next, lockedUntil: 0 }))
        setAttempts(next)
        setError('Código incorrecto. Verifica el código que recibiste por correo.')
      }
      setDigits(['', '', '', ''])
      inputs.current[0]?.focus()
    } catch (verificationError) {
      setError(verificationError.message || 'No se pudo verificar el código.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <Header event={access.event} club={access.club} />
      <main className="mx-auto flex min-h-[calc(100vh-76px)] max-w-lg items-center p-4">
        <form onSubmit={verify} className="card w-full p-6 text-center sm:p-9">
          <p className="text-sm font-extrabold uppercase tracking-[.18em] text-brand-600">SWIMTIMER · Inscripciones</p>
          <h1 className="mt-4 text-2xl font-extrabold text-brand-800">{access.event.name}</h1>
          <p className="mt-1 text-slate-600">
            Club: <strong>{access.club.name}</strong>
          </p>
          <h2 className="mt-7 text-lg font-bold">Ingresa tu código de acceso</h2>
          <div className="mx-auto mt-4 flex max-w-xs justify-center gap-2" onPaste={paste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputs.current[index] = element
                }}
                aria-label={`Dígito ${index + 1}`}
                className="h-16 w-14 rounded-lg border border-slate-300 text-center text-2xl font-extrabold text-brand-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                inputMode="numeric"
                maxLength="1"
                value={digit}
                autoFocus={index === 0}
                onChange={(event) => changeDigit(index, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Backspace' && !digit && index > 0) inputs.current[index - 1]?.focus()
                }}
              />
            ))}
          </div>
          <p className="field-help mt-3">El código fue enviado a tu correo</p>
          {error && <p className="mt-4 rounded-lg bg-danger-50 p-3 text-sm font-bold text-danger-700">{error}</p>}
          <button className="btn-primary mt-5 w-full" disabled={checking || locked || digits.some((digit) => !digit)}>
            {checking ? 'Verificando…' : 'Verificar'}
          </button>
          <p className="mt-5 text-sm text-slate-500">¿No tienes el código? Solicítalo al organizador del evento.</p>
        </form>
      </main>
    </>
  )
}

function readAttempts(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key)) || {}
    if (value.lockedUntil && value.lockedUntil <= Date.now()) {
      localStorage.removeItem(key)
      return { attempts: 0, lockedUntil: 0 }
    }
    return {
      attempts: Number(value.attempts) || 0,
      lockedUntil: Number(value.lockedUntil) || 0
    }
  } catch {
    return { attempts: 0, lockedUntil: 0 }
  }
}
