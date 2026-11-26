import { isSupabaseConfigured, supabase } from './supabase'

export async function googleCalendarAction(action, payload = {}) {
  if (!isSupabaseConfigured || !supabase) return { data: { skipped: true, reason: 'demo_mode' }, error: null }
  return supabase.functions.invoke('google-calendar-appointments', {
    body: { action, ...payload },
  })
}
