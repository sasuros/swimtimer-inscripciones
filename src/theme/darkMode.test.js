import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compileCss, currentLightSnapshot, resolvedRules } from '../../scripts/lightCss.mjs'
import { gateViolations } from '../../scripts/compareLightCss.mjs'
import { ADMIN_TOKEN_MAP, EXTRA_PAIRS, MIGRATED_ADMIN_FILES, migrateClasses } from '../../scripts/adminTokenMap.mjs'
import tailwindConfig from '../../tailwind.config.js'
import { ADMIN_THEME_KEY, applyAdminTheme, readAdminTheme } from '../utils/adminTheme'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const unescape = (key) => key.replace(/\\/g, '')
const VARIANTS = ['', 'hover:']
const OPACITIES = ['', '/20', '/30', '/70', '/80']

describe('GATE: el modo claro queda idéntico (admin, wizard y landing)', () => {
  // Baseline = CSS compilado de v1.14.0 con valores resueltos (scripts/light-css-baseline.json).
  it('ningún valor resuelto en claro cambia; solo desaparecen clases migradas y aparecen tokens', async () => {
    const baseline = JSON.parse(read('scripts/light-css-baseline.json'))
    expect(gateViolations(baseline, await currentLightSnapshot())).toEqual({ changed: [], removedUnexpected: [], addedNonClass: [] })
  }, 30000)

  it('cada clase migrada resuelve en claro exactamente igual que la de paleta que reemplaza', async () => {
    const pairs = [
      ...Object.entries(ADMIN_TOKEN_MAP).flatMap(([old, next]) => VARIANTS.flatMap((v) => OPACITIES.map((o) => [`${v}${old}${o}`, `${v}${next}${o}`]))),
      ...EXTRA_PAIRS
    ]
    const cssRoot = await compileCss({ content: [{ raw: pairs.flat().join(' ') }] })
    const rules = Object.fromEntries(Object.entries(resolvedRules(cssRoot)).map(([key, value]) => [unescape(key), value]))
    const find = (token) => rules[`.${token}`] || rules[`.${token}:hover`]
    let compared = 0
    for (const [old, next] of pairs) {
      if (!find(old)) continue // combinación que Tailwind no genera (p. ej. hover: sin uso)
      expect({ token: next, decls: find(next) }).toEqual({ token: next, decls: find(old) })
      compared += 1
    }
    expect(compared).toBeGreaterThanOrEqual(Object.keys(ADMIN_TOKEN_MAP).length + EXTRA_PAIRS.length)
  }, 30000)

  it('los archivos del admin migrados ya no usan clases de paleta con reemplazo', () => {
    for (const file of MIGRATED_ADMIN_FILES) {
      const source = read(file)
      expect({ file, pending: migrateClasses(source) !== source }).toEqual({ file, pending: false })
    }
  })

  it('brand-700 sigue sin definirse (no se mueve el claro)', async () => {
    expect(tailwindConfig.theme.extend.colors.brand).not.toHaveProperty('700')
    const cssRoot = await compileCss()
    expect(cssRoot.toString()).not.toMatch(/\.text-brand-700\b/)
  }, 30000)
})

describe('oscuro: solo por atributo, solo en pantalla, legible', () => {
  it('el oscuro nunca se activa por la preferencia del sistema', async () => {
    expect(tailwindConfig.darkMode).toEqual(['selector', '[data-theme="dark"]'])
    expect((await compileCss()).toString()).not.toMatch(/prefers-color-scheme/)
  }, 30000)

  it('toda regla oscura vive dentro de @media screen: imprimir desde oscuro resuelve tokens claros', async () => {
    const cssRoot = await compileCss()
    const dark = []
    cssRoot.walkRules((rule) => {
      if (rule.selector.includes('[data-theme')) dark.push({ selector: rule.selector, media: rule.parent?.type === 'atrule' ? `${rule.parent.name} ${rule.parent.params}` : 'ninguna' })
    })
    expect(dark.length).toBeGreaterThan(0)
    expect(dark.filter((item) => item.media !== 'media screen')).toEqual([])
  }, 30000)

  it('en oscuro los inputs usan color-scheme dark (fechas y selects) y el logo del login se aclara', () => {
    const css = read('src/index.css')
    expect(css).toMatch(/\[data-theme="dark"\] \.input \{ color-scheme: dark; \}/)
    expect(css).toMatch(/\[data-theme="dark"\] \.login-logo \{ filter: brightness\(0\) invert\(1\); \}/)
    expect(read('src/pages/AdminLogin.jsx')).toContain('login-logo')
  })

  it('contraste AA (≥ 4.5) de textos y estados sobre las superficies oscuras', async () => {
    const cssRoot = await compileCss()
    const tokens = {}
    cssRoot.walkRules((rule) => {
      if (rule.selector.trim() !== '[data-theme="dark"]') return
      rule.walkDecls((decl) => {
        if (decl.prop.startsWith('--')) tokens[decl.prop.slice(2)] = decl.value.trim().split(/\s+/).map(Number)
      })
    })
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
    const white = [255, 255, 255]
    const low = []
    const check = (name, fg, bg) => {
      if (ratio(fg, bg) < 4.5) low.push(`${name}: ${ratio(fg, bg).toFixed(2)}`)
    }
    for (const bg of ['app', 'surface', 'surface-muted', 'surface-alt'])
      for (const fg of ['ink', 'ink-strong', 'ink-soft', 'ink-muted', 'ink-subtle', 'brand-fg', 'danger-fg', 'warning-fg', 'success-fg']) check(`${fg} / ${bg}`, tokens[fg], tokens[bg])
    for (const state of ['success', 'warning', 'danger']) check(`${state}-fg / ${state}-bg`, tokens[`${state}-fg`], tokens[`${state}-bg`])
    for (const solid of ['success-solid', 'warning-solid', 'danger-solid', 'info-solid']) check(`blanco / ${solid}`, white, tokens[solid])
    check('ink / surface-strong (badge neutro)', tokens.ink, tokens['surface-strong'])
    check('ink / control (botón secundario)', tokens.ink, tokens.control)
    expect(low).toEqual([])
  }, 30000)
})

describe('aislamiento: el entrenador y la landing nunca ven el oscuro', () => {
  const boot = read('index.html').match(/<script id="admin-theme-boot">([\s\S]*?)<\/script>/)[1]
  const runBoot = (pathname, stored) => {
    const attributes = {}
    const document = { documentElement: { setAttribute: (name, value) => { attributes[name] = value } } }
    const localStorage = { getItem: (key) => (key === ADMIN_THEME_KEY ? stored : null) }
    new Function('location', 'localStorage', 'document', boot)({ pathname }, localStorage, document)
    return attributes['data-theme']
  }

  it('en /inscribir con swimtimer-admin-theme=dark, <html> NO recibe data-theme', () => {
    expect(runBoot('/inscribir', 'dark')).toBeUndefined()
  })

  it('tampoco en la landing ni en otras rutas públicas', () => {
    expect(runBoot('/', 'dark')).toBeUndefined()
    expect(runBoot('/resultados', 'dark')).toBeUndefined()
  })

  it('en /admin solo con la preferencia guardada; por defecto claro', () => {
    expect(runBoot('/admin/eventos', 'dark')).toBe('dark')
    expect(runBoot('/admin', 'dark')).toBe('dark')
    expect(runBoot('/admin/eventos', null)).toBeUndefined()
    expect(runBoot('/admin/eventos', 'light')).toBeUndefined()
  })

  it('si localStorage lanza (modo privado), no rompe ni aplica oscuro', () => {
    const attributes = {}
    const document = { documentElement: { setAttribute: (name, value) => { attributes[name] = value } } }
    const localStorage = { getItem: () => { throw new Error('bloqueado') } }
    expect(() => new Function('location', 'localStorage', 'document', boot)({ pathname: '/admin' }, localStorage, document)).not.toThrow()
    expect(attributes).toEqual({})
  })

  it('el toggle en caliente tampoco aplica oscuro fuera de /admin', () => {
    const root = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value }, removeAttribute(name) { delete this.attrs[name] } }
    applyAdminTheme('dark', { root, pathname: '/inscribir' })
    expect(root.attrs).toEqual({})
    applyAdminTheme('dark', { root, pathname: '/admin/eventos' })
    expect(root.attrs).toEqual({ 'data-theme': 'dark' })
    applyAdminTheme('light', { root, pathname: '/admin/eventos' })
    expect(root.attrs).toEqual({})
  })

  it('readAdminTheme: claro por defecto y ante errores', () => {
    expect(readAdminTheme({ getItem: () => null })).toBe('light')
    expect(readAdminTheme({ getItem: () => 'dark' })).toBe('dark')
    expect(readAdminTheme({ getItem: () => { throw new Error('x') } })).toBe('light')
    expect(readAdminTheme(null)).toBe('light')
  })
})
