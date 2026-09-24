// Modo oscuro SOLO del admin (v1.15.0). Por defecto claro; nunca sigue la preferencia
// del sistema. El arranque (antes de pintar) lo hace el script #admin-theme-boot de
// index.html con la misma regla; esto es para el toggle en caliente.
export const ADMIN_THEME_KEY = 'swimtimer-admin-theme'

export const isAdminPath = (pathname) => String(pathname || '').startsWith('/admin')

const browserStorage = () => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readAdminTheme(storage = browserStorage()) {
  try {
    return storage?.getItem(ADMIN_THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function saveAdminTheme(theme, storage = browserStorage()) {
  try {
    storage?.setItem(ADMIN_THEME_KEY, theme === 'dark' ? 'dark' : 'light')
  } catch {
    // Sin almacenamiento (modo privado): el tema dura hasta recargar.
  }
}

export function applyAdminTheme(theme, { root = document.documentElement, pathname = window.location.pathname } = {}) {
  if (theme === 'dark' && isAdminPath(pathname)) root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
}
