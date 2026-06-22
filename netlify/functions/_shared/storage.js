import { getStore } from '@netlify/blobs'
export const store = () => getStore({ name: 'swimtimer', consistency: 'strong' })
export async function getJson(key) { return store().get(key, { type: 'json' }) }
export async function setJson(key, value) { return store().setJSON(key, value) }
export async function listJson(prefix) {
  const blobStore = store()
  const indexName = prefix === 'tokens:' ? 'index:tokens' : 'index:inscriptions'
  const keys = await blobStore.get(indexName, { type: 'json' }) || []
  const values = await Promise.all(keys.map(key => blobStore.get(`${prefix}${key}`, { type: 'json' })))
  return values.filter(Boolean)
}
export async function addToIndex(indexName, key) {
  const blobStore = store()
  const current = await blobStore.get(indexName, { type: 'json' }) || []
  if (!current.includes(key)) await blobStore.setJSON(indexName, [...current, key])
}
