// Montaje mínimo con React DOM real para tests de interfaz (entorno jsdom, sin librerías extra).
import { act } from 'react'
import { createRoot } from 'react-dom/client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mounted = []

// `id`: p. ej. 'root', para montar como la app real (index.html).
export async function mount(element, { id } = {}) {
  const host = document.createElement('div')
  if (id) host.id = id
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => root.render(element))
  mounted.push({ root, host })
  return {
    host,
    rerender: (next) => act(async () => root.render(next))
  }
}

export async function unmountAll() {
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => root.unmount())
    host.remove()
  }
}

// Espera a que terminen las promesas encadenadas (cargas del tablero, escrituras del fake).
export const settle = () => act(async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
})

export const click = (element) => act(async () => {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})

export const buttons = (root = document.body) => [...root.querySelectorAll('button')]
export const button = (text, root = document.body) => buttons(root).find((item) => item.textContent.trim().includes(text))
export const dialog = () => document.querySelector('[role="dialog"]')
export const checkbox = (name, root = document.body) => [...root.querySelectorAll('label')].find((label) => label.textContent.includes(name))?.querySelector('input[type="checkbox"]')
