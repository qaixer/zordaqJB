import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key && !url.includes('projek-anda'))
export const supabase = isSupabaseConfigured ? createClient(url, key) : null

export const demoUsers = [
  { id: 'demo-admin', email: 'paan@zordaq.my', full_name: 'Paan Zordaq', nickname: 'Paan', role: 'admin', is_active: true },
  { id: 'demo-staff', email: 'staff@zordaq.my', full_name: 'Aiman Hakimi', nickname: 'Aiman', role: 'staff', is_active: true },
]

export const demoPassword = '12345678'

export function readDemo(key, fallback) {
  try { return JSON.parse(localStorage.getItem(`zordaq:${key}`)) ?? fallback } catch { return fallback }
}

export function writeDemo(key, value) {
  localStorage.setItem(`zordaq:${key}`, JSON.stringify(value))
}
