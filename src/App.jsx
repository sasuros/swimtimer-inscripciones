import InscriptionWizard from './pages/InscriptionWizard'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminEvents from './pages/AdminEvents'
import EventEditor from './pages/EventEditor'
import ImportMeetManager from './pages/ImportMeetManager'

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  if (path.startsWith('/admin')) {
    if (!sessionStorage.getItem('swimtimer-admin-token')) return <AdminLogin />
    if (path === '/admin' || path === '/admin/eventos') return <AdminEvents />
    if (path === '/admin/eventos/nuevo') return <EventEditor />
    if (path === '/admin/eventos/importar') return <ImportMeetManager />
    const cloneMatch = path.match(/^\/admin\/eventos\/clonar\/([^/]+)$/)
    if (cloneMatch) return <EventEditor cloneId={cloneMatch[1]} />
    const editMatch = path.match(/^\/admin\/eventos\/([^/]+)\/editar$/)
    if (editMatch) return <EventEditor eventId={editMatch[1]} />
    const dashboardMatch = path.match(/^\/admin\/eventos\/([^/]+)$/)
    if (dashboardMatch) return <AdminDashboard eventId={dashboardMatch[1]} />
    return <AdminEvents />
  }
  return <InscriptionWizard />
}
