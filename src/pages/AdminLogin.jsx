import { useState } from 'react'
import ErrorMessage from '../components/ErrorMessage'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault(); setLoading(true); setError('')
    try { const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); sessionStorage.setItem('swimtimer-admin-token', data.token); window.location.reload() } catch (err) { setError(err.message || 'No se pudo iniciar sesión') } finally { setLoading(false) }
  }
  return <main className="mx-auto flex min-h-screen max-w-md items-center p-4"><form onSubmit={submit} className="card w-full p-8"><img src="/logo.svg" alt="SWIMTIMER" className="size-14" /><h1 className="mt-5 text-2xl font-bold">Panel del organizador</h1><p className="mt-1 text-slate-500">Acceso privado de SWIMTIMER</p><label htmlFor="password" className="label mt-6">Contraseña</label><input id="password" type="password" className={`input ${error ? 'input-error' : ''}`} value={password} onChange={event => setPassword(event.target.value)} autoFocus /><ErrorMessage>{error}</ErrorMessage><button className="btn-primary mt-5 w-full" disabled={!password || loading}>{loading ? 'Entrando…' : 'Entrar'}</button></form></main>
}
