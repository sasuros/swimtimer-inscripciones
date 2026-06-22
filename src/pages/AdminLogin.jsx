import { useState } from 'react'
import ErrorMessage from '../components/ErrorMessage'
import { adminLogin } from '../services/api'
import { DEMO_ADMIN_PASSWORD, DEMO_MODE } from '../config'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault(); setLoading(true); setError('')
    try { const data = await adminLogin(password); sessionStorage.setItem('swimtimer-admin-token', data.token); window.location.reload() } catch (err) { setError(err.message || 'No se pudo iniciar sesión') } finally { setLoading(false) }
  }
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-4"><form onSubmit={submit} className="card w-full p-8"><img src="/logo.svg" alt="SWIMTIMER" className="size-14" /><h1 className="mt-5 text-2xl font-bold">Panel del organizador</h1><p className="mt-1 text-slate-500">Acceso privado de SWIMTIMER</p>{DEMO_MODE && <p className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-800"><strong>Demo local:</strong> la clave es <code>{DEMO_ADMIN_PASSWORD}</code></p>}<label htmlFor="password" className="label mt-6">Contraseña</label><input id="password" type="password" className={`input ${error ? 'input-error' : ''}`} value={password} onChange={event => setPassword(event.target.value)} autoFocus /><ErrorMessage>{error}</ErrorMessage><button className="btn-primary mt-5 w-full" disabled={!password || loading}>{loading ? 'Entrando…' : 'Entrar'}</button></form></main>
}
