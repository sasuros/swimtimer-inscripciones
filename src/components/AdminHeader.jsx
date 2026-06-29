import { LogOut } from 'lucide-react'
import Logo from './Logo'

export default function AdminHeader({ children }) {
  const logout = () => { sessionStorage.removeItem('swimtimer-admin-token'); window.location.href = '/admin' }
  return <header className="app-header border-b border-[#1B3A5C] bg-[#1B3A5C] text-white"><div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6"><a href="/admin/eventos"><Logo className="size-12" /></a><div className="mr-auto"><p className="font-extrabold tracking-wider text-white">SWIMTIMER</p><p className="text-xs text-slate-300">Gestión de inscripciones · Demostración local</p></div>{children}<button className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={logout}><LogOut className="size-4" /><span className="hidden sm:inline">Salir</span></button></div></header>
}
