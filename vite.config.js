import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // v1.20.1: la clave de firma no tiene valor por defecto; en los tests se usa una ficticia.
  test: { env: { VITE_ADMIN_PASSWORD: 'clave-de-prueba' } }
})
