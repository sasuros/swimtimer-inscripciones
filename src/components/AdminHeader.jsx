import { useState } from 'react'
import { CalendarDays, LogOut, Moon, Sun, Wrench } from 'lucide-react'
import { DEMO_MODE } from '../config'
import { supabase } from '../services/supabase'
import { applyAdminTheme, saveAdminTheme } from '../utils/adminTheme'
import Logo from './Logo'

/* global __APP_VERSION__ */

export default function AdminHeader({ children }) {
  const logout = async () => {
    sessionStorage.removeItem('swimtimer-admin-token')
    sessionStorage.removeItem('swimtimer-admin-password')
    if (!DEMO_MODE && supabase) await supabase.auth.signOut()
    window.location.href = '/admin'
  }
  const path = window.location.pathname
  const navClass = active => `btn-secondary inline-flex items-center gap-2 text-sm ${active ? 'bg-white/15' : ''}`
  const eventsActive = path === '/admin' || path.startsWith('/admin/eventos')
  const [theme, setTheme] = useState(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'))
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    saveAdminTheme(next)
    applyAdminTheme(next)
    setTheme(next)
  }
  const themeLabel = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'

  return <header className="app-header border-b border-[#1B3A5C] bg-[#1B3A5C] text-white">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
      <a href="/admin/eventos"><Logo className="size-12" /></a>
      <div className="mr-auto">
        <p className="font-extrabold tracking-wider text-white">SWIMTIMER</p>
        <p className="text-xs text-slate-300">Gestión de inscripciones{DEMO_MODE ? ' · Demo local' : ''}</p>
        <p className="text-[10px] text-slate-400">v{__APP_VERSION__}</p>
      </div>
      <nav className="order-3 flex w-full gap-2 sm:order-none sm:w-auto" aria-label="Navegación administrativa">
        <a className={navClass(eventsActive)} href="/admin/eventos" aria-current={eventsActive ? 'page' : undefined}><CalendarDays className="size-4" />Inicio</a>
        <a className={navClass(path === '/admin/herramientas')} href="/admin/herramientas" aria-current={path === '/admin/herramientas' ? 'page' : undefined}><Wrench className="size-4" />Herramientas</a>
      </nav>
      {children}
      <button className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={toggleTheme} aria-pressed={theme === 'dark'} aria-label={themeLabel} title={themeLabel}>{theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
      <button className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={logout}><LogOut className="size-4" /><span className="hidden sm:inline">Salir</span></button>
    </div>
  </header>
}
