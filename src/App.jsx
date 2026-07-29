import { lazy, Suspense, useEffect, useState } from 'react'
import { DEMO_MODE } from './config'
import { supabase } from './services/supabase'

const PublicLanding = lazy(() => import('./pages/PublicLanding'))
const InscriptionWizard = lazy(() => import('./pages/InscriptionWizard'))
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminEvents = lazy(() => import('./pages/AdminEvents'))
const AdminTools = lazy(() => import('./pages/AdminTools'))
const EventEditor = lazy(() => import('./pages/EventEditor'))
const ImportMeetManager = lazy(() => import('./pages/ImportMeetManager'))

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const auth = useAdminAuth(path)
  let content
  if (path.startsWith('/admin')) {
    if (DEMO_MODE && !sessionStorage.getItem('swimtimer-admin-token')) content = <AdminLogin />
    else if (!DEMO_MODE && auth.loading) content = <AdminLoading />
    else if (!DEMO_MODE && !auth.session) content = <AdminLogin />
    else if (path === '/admin' || path === '/admin/eventos') content = <AdminEvents />
    else if (path === '/admin/herramientas') content = <AdminTools />
    else if (path === '/admin/eventos/nuevo') content = <EventEditor />
    else if (path === '/admin/eventos/importar') content = <ImportMeetManager />
    else {
      const cloneMatch = path.match(/^\/admin\/eventos\/clonar\/([^/]+)$/)
      const editMatch = path.match(/^\/admin\/eventos\/([^/]+)\/editar$/)
      const dashboardMatch = path.match(/^\/admin\/eventos\/([^/]+)$/)
      content = cloneMatch ? <EventEditor cloneId={cloneMatch[1]} /> : editMatch ? <EventEditor eventId={editMatch[1]} /> : dashboardMatch ? <AdminDashboard eventId={dashboardMatch[1]} /> : <AdminEvents />
    }
  } else content = path.startsWith('/inscribir') ? <InscriptionWizard /> : <PublicLanding />
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-100 font-bold text-brand-800">Cargando SWIMTIMER...</div>}>{content}</Suspense>
}

function useAdminAuth(path) {
  const isAdminPath = path.startsWith('/admin')
  const [state, setState] = useState({ session: null, loading: !DEMO_MODE && isAdminPath })

  useEffect(() => {
    if (DEMO_MODE || !isAdminPath || !supabase) {
      setState({ session: null, loading: false })
      return undefined
    }

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setState({ session: data.session || null, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session: session || null, loading: false })
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [isAdminPath])

  return state
}

function AdminLoading() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-100 font-bold text-brand-800">Verificando sesion...</div>
}
