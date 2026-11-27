export const TIME_ZONE = 'Asia/Kuala_Lumpur'

export function nowIso() {
  return new Date().toISOString()
}

export function formatDate(value, options = {}) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-MY', { timeZone: TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric', ...options }).format(new Date(value))
}

export function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-MY', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function todayLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function yearLocal() {
  return Number(new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE, year: 'numeric' }).format(new Date()))
}

export function greetingLocal(value = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en', { timeZone: TIME_ZONE, hour: 'numeric', hour12: false }).format(value))
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function hoursBetween(start, end) {
  if (!start || !end) return 0
  return Math.max(0, (new Date(end) - new Date(start)) / 36e5)
}

