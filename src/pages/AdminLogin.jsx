import { useState } from 'react'
import ErrorMessage from '../components/ErrorMessage'
import Logo from '../components/Logo'
import { adminLogin } from '../services/api'
import { supabase } from '../services/supabase'
import { DEMO_ADMIN_PASSWORD, DEMO_MODE } from '../config'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (DEMO_MODE) {
        const data = await adminLogin(password)
        sessionStorage.setItem('swimtimer-admin-token', data.token)
        sessionStorage.setItem('swimtimer-admin-password', password)
        window.location.reload()
        return
      }

      if (!supabase) throw new Error('Supabase no esta configurado')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (error) {
      setError(error.message || 'No se pudo iniciar sesion')
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || !password || (!DEMO_MODE && !email)

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-4">
      <form onSubmit={submit} className="card w-full p-8">
        <Logo className="size-24" showByline variant="color" />
        <h1 className="mt-5 text-2xl font-bold text-brand-800">Panel del organizador</h1>
        <p className="mt-1 text-slate-500">Acceso privado de SWIMTIMER</p>
        {DEMO_MODE && (
          <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            <strong>Demostracion local:</strong> la clave es <code>{DEMO_ADMIN_PASSWORD}</code>
          </p>
        )}
        {!DEMO_MODE && (
          <>
            <label htmlFor="email" className="label mt-6">Correo electronico</label>
            <input id="email" type="email" className={`input ${error ? 'input-error' : ''}`} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus />
          </>
        )}
        <label htmlFor="password" className={`label ${DEMO_MODE ? 'mt-6' : 'mt-4'}`}>Contrasena</label>
        <input id="password" type="password" className={`input ${error ? 'input-error' : ''}`} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={DEMO_MODE ? 'current-password' : 'current-password'} autoFocus={DEMO_MODE} />
        <ErrorMessage>{error}</ErrorMessage>
        <button className="btn-primary mt-5 w-full" disabled={disabled}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </main>
  )
}
