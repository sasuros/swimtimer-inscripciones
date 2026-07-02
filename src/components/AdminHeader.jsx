import { CalendarDays, LogOut, Wrench } from 'lucide-react'
import { DEMO_MODE } from '../config'
import Logo from './Logo'

export default function AdminHeader({ children }) {
  const logout = () => { sessionStorage.removeItem('swimtimer-admin-token'); sessionStorage.removeItem('swimtimer-admin-password'); window.location.href = '/admin' }
  const path = window.location.pathname
  const navClass = active => `btn-secondary inline-flex items-center gap-2 text-sm ${active ? 'bg-white/15' : ''}`
  const eventsActive = path === '/admin' || path.startsWith('/admin/eventos')

  return <header className="app-header border-b border-[#1B3A5C] bg-[#1B3A5C] text-white">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
      <a href="/admin/eventos"><Logo className="size-12" /></a>
      <div className="mr-auto">
        <p className="font-extrabold tracking-wider text-white">SWIMTIMER</p>
        <p className="text-xs text-slate-300">Gestión de inscripciones{DEMO_MODE ? ' · Demo local' : ''}</p>
      </div>
      <nav className="order-3 flex w-full gap-2 sm:order-none sm:w-auto" aria-label="Navegación administrativa">
        <a className={navClass(eventsActive)} href="/admin/eventos" aria-current={eventsActive ? 'page' : undefined}><CalendarDays className="size-4" />Mis eventos</a>
        <a className={navClass(path === '/admin/herramientas')} href="/admin/herramientas" aria-current={path === '/admin/herramientas' ? 'page' : undefined}><Wrench className="size-4" />Herramientas</a>
      </nav>
      {children}
      <button className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={logout}><LogOut className="size-4" /><span className="hidden sm:inline">Salir</span></button>
    </div>
  </header>
}
