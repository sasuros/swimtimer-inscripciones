// Gate del modo claro: compara el CSS claro resuelto de hoy contra
// scripts/light-css-baseline.json (v1.14.0). Lo usa src/theme/darkMode.test.js.
// Uso manual: node scripts/compareLightCss.mjs   (código 1 si hay violaciones)
import { readFileSync } from 'node:fs'
import { currentLightSnapshot } from './lightCss.mjs'
import { ADMIN_TOKEN_MAP } from './adminTokenMap.mjs'

const unescape = (key) => key.replace(/\\/g, '')

export function diffSnapshots(baseline, current) {
  const changed = []
  const removed = []
  const added = []
  for (const key of Object.keys(baseline)) {
    if (!(key in current)) removed.push(key)
    else if (JSON.stringify(baseline[key]) !== JSON.stringify(current[key])) changed.push({ key, before: baseline[key], after: current[key] })
  }
  for (const key of Object.keys(current)) if (!(key in baseline)) added.push(key)
  return { changed, removed, added }
}

// Violaciones: cualquier valor claro distinto; una regla que desaparece sin ser una
// clase migrada del admin (con variante/opacidad); o algo nuevo que no sea una clase.
export function gateViolations(baseline, current) {
  const { changed, removed, added } = diffSnapshots(baseline, current)
  const migrated = new Set(
    Object.keys(ADMIN_TOKEN_MAP).flatMap((old) => ['', 'hover:'].flatMap((variant) => ['', '/20', '/30', '/70', '/80'].flatMap((opacity) => [`.${variant}${old}${opacity}`, `.${variant}${old}${opacity}:hover`])))
  )
  return {
    changed,
    removedUnexpected: removed.filter((key) => !migrated.has(unescape(key))),
    addedNonClass: added.filter((key) => !/^\.[^\s,]+$/.test(key))
  }
}

if (process.argv[1]?.endsWith('compareLightCss.mjs')) {
  const baseline = JSON.parse(readFileSync(new URL('./light-css-baseline.json', import.meta.url), 'utf8'))
  const violations = gateViolations(baseline, await currentLightSnapshot())
  console.log(JSON.stringify(violations, null, 1))
  if (Object.values(violations).some((list) => list.length)) process.exit(1)
}
