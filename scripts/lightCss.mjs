// Compila el CSS de la app (Tailwind + index.css, igual que el build) y lo reduce a
// "valores resueltos en modo claro": cada var(--token) se reemplaza por su valor de
// :root y los colores se normalizan (hex → rgb). Las reglas del modo oscuro
// ([data-theme="dark"]) se excluyen. Sirve de gate: el modo claro no puede cambiar.
//
// Regenerar el baseline (solo si un cambio visual en modo claro es intencional):
//   node scripts/lightCss.mjs > scripts/light-css-baseline.json
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const root = new URL('../', import.meta.url)

export async function loadConfig() {
  const { default: config } = await import(new URL(`tailwind.config.js?t=${Date.now()}`, root).href)
  return config
}

export async function compileCss({ css = readFileSync(new URL('src/index.css', root), 'utf8'), config, content } = {}) {
  const base = config || (await loadConfig())
  const finalConfig = content ? { ...base, content } : base
  const result = await postcss([tailwindcss(finalConfig), autoprefixer]).process(css, { from: new URL('src/index.css', root).pathname })
  return result.root
}

const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi
function hexToRgb(hex) {
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  return `rgb(${parseInt(full.slice(0, 2), 16)} ${parseInt(full.slice(2, 4), 16)} ${parseInt(full.slice(4, 6), 16)})`
}
export const normalizeValue = (value) =>
  value
    .replace(HEX, (_m, hex) => hexToRgb(hex.toLowerCase()))
    .replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, 'rgb($1 $2 $3)')
    .replace(/\s+/g, ' ')
    .trim()

const isDark = (selector) => selector.includes('[data-theme')
const chainOf = (node) => {
  const chain = []
  for (let parent = node.parent; parent && parent.type !== 'root'; parent = parent.parent) if (parent.type === 'atrule') chain.unshift(`@${parent.name} ${parent.params}`)
  return chain.join(' ')
}

// Tokens del modo claro: custom properties de ":root" fuera de cualquier @media.
export function lightTokens(cssRoot) {
  const tokens = {}
  cssRoot.walkRules((rule) => {
    if (rule.selector.trim() !== ':root' || chainOf(rule)) return
    rule.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) tokens[decl.prop] = decl.value.trim()
    })
  })
  return tokens
}

export function resolveValue(value, tokens) {
  let out = value
  for (let depth = 0; depth < 5 && /var\(--/.test(out); depth += 1) out = out.replace(/var\((--[\w-]+)\)/g, (match, name) => (name in tokens ? tokens[name] : match))
  return normalizeValue(out)
}

// { "<@media…> <selector>": [[ "prop:valor", … ], …] }  (una lista por regla, en orden)
export function resolvedRules(cssRoot) {
  const tokens = lightTokens(cssRoot)
  const rules = {}
  cssRoot.walkRules((rule) => {
    if (isDark(rule.selector) || rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') return
    if (rule.selector.trim() === ':root' && !chainOf(rule)) return
    const key = `${chainOf(rule)} ${rule.selector.replace(/\s+/g, ' ').trim()}`.trim()
    const decls = []
    rule.walkDecls((decl) => decls.push(`${decl.prop}:${resolveValue(decl.value, tokens)}${decl.important ? ' !important' : ''}`))
    ;(rules[key] ||= []).push(decls)
  })
  return rules
}

export async function currentLightSnapshot() {
  return resolvedRules(await compileCss())
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/').replace(/^\//, '')}`) {
  process.stdout.write(`${JSON.stringify(await currentLightSnapshot(), null, 1)}\n`)
}
