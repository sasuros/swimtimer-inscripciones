import { describe, expect, it, vi } from 'vitest'
import { createSupabaseClient, isValidSupabaseUrl } from './supabase'

describe('configuración defensiva de Supabase', () => {
  it('rechaza valores vacíos, espacios y protocolos no HTTP', () => {
    expect(isValidSupabaseUrl('')).toBe(false)
    expect(isValidSupabaseUrl('   ')).toBe(false)
    expect(isValidSupabaseUrl('undefined')).toBe(false)
    expect(isValidSupabaseUrl('ftp://supabase.example.com')).toBe(false)
    expect(isValidSupabaseUrl('https://supabase.example.com')).toBe(true)
  })

  it('no llama createClient sin URL y clave válidas', () => {
    const factory = vi.fn()
    expect(createSupabaseClient('   ', 'key', factory)).toBeNull()
    expect(createSupabaseClient('https://supabase.example.com', '   ', factory)).toBeNull()
    expect(factory).not.toHaveBeenCalled()
  })

  it('recorta credenciales válidas antes de crear el cliente', () => {
    const client = { from: vi.fn() }
    const factory = vi.fn(() => client)
    expect(createSupabaseClient(' https://supabase.example.com ', ' key ', factory)).toBe(client)
    expect(factory).toHaveBeenCalledWith('https://supabase.example.com', 'key')
  })

  it('captura excepciones del SDK y devuelve null', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const factory = vi.fn(() => { throw new Error('URL inválida') })
    expect(createSupabaseClient('https://supabase.example.com', 'key', factory)).toBeNull()
    expect(warning).toHaveBeenCalled()
    warning.mockRestore()
  })
})
