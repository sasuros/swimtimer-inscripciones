import InscriptionWizard from './pages/InscriptionWizard'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  if (path === '/admin') return sessionStorage.getItem('swimtimer-admin-token') ? <AdminDashboard /> : <AdminLogin />
  return <InscriptionWizard />
}
