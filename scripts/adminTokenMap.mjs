// v1.15.0 — Migración del admin a tokens semánticos: clase de paleta → token.
// Cada par resuelve EXACTAMENTE al mismo valor en modo claro (lo verifica
// src/theme/darkMode.test.js); en oscuro el token se recalibra.
// Se aplica también con prefijo de variante (hover:) y con opacidad (/80).
export const ADMIN_TOKEN_MAP = {
  // Superficies
  'bg-white': 'bg-surface',
  'bg-slate-50': 'bg-surface-muted',
  'bg-slate-100': 'bg-surface-alt',
  'bg-slate-200': 'bg-surface-strong',
  'bg-slate-950': 'bg-overlay',
  // Texto
  'text-slate-700': 'text-ink',
  'text-slate-600': 'text-ink-soft',
  'text-slate-500': 'text-ink-muted',
  'text-slate-400': 'text-ink-subtle',
  'text-brand-800': 'text-ink-strong',
  // Bordes
  'border-slate-100': 'border-line-soft',
  'border-slate-200': 'border-line',
  'border-slate-300': 'border-line-strong',
  // Marca y estados (fondo suave / texto / sólido con texto blanco)
  'text-brand-600': 'text-brand-fg',
  'bg-brand-50': 'bg-brand-bg',
  'border-brand-600': 'border-brand-fg',
  'text-danger-700': 'text-danger-fg',
  'bg-danger-50': 'bg-danger-bg',
  'border-danger-700': 'border-danger-fg',
  'text-warning-800': 'text-warning-fg',
  'bg-warning-50': 'bg-warning-bg',
  'border-warning-800': 'border-warning-fg',
  'bg-warning-800': 'bg-warning-solid',
  'text-success-800': 'text-success-fg',
  'bg-success-50': 'bg-success-bg',
  'bg-success-800': 'bg-success-solid',
  // Badge "Próximamente" de publicación
  'bg-[#1B3A5C]': 'bg-info-solid'
}

// Pares puntuales fuera del mapeo general (misma garantía de equivalencia en claro).
export const EXTRA_PAIRS = [['bg-slate-100', 'bg-app']] // pantalla "Verificando sesión" (App.jsx, solo admin)

// Archivos del admin migrados. AdminHeader (ya oscuro), PrintRoster (solo impresión)
// y los compartidos con el wizard (Logo, ErrorMessage) no se migran.
export const MIGRATED_ADMIN_FILES = [
  'src/pages/AdminDashboard.jsx',
  'src/pages/AdminEvents.jsx',
  'src/pages/EventEditor.jsx',
  'src/pages/AdminLogin.jsx',
  'src/pages/AdminTools.jsx',
  'src/pages/ImportMeetManager.jsx',
  'src/components/CloseRegistrationModal.jsx',
  'src/components/DeleteEventModal.jsx',
  'src/components/EmailInvitationsPanel.jsx',
  'src/components/ExportMenu.jsx',
  'src/components/LateReviewPanel.jsx',
  'src/components/LinkDistributionModal.jsx'
]

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

// Reemplaza solo tokens completos de clase (con variante y opacidad opcionales).
export function migrateClasses(source, map = ADMIN_TOKEN_MAP) {
  const bases = Object.keys(map).sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(^|[\\s'"\`])((?:hover:|focus:|disabled:)?)(${bases.map(escape).join('|')})(/\\d+)?(?=[\\s'"\`]|$)`, 'gm')
  return source.replace(pattern, (_m, lead, variant, base, opacity = '') => `${lead}${variant}${map[base]}${opacity}`)
}
