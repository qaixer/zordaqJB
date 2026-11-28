import { Component, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, ArrowRight, CalendarDays, CalendarRange, Check, ChevronDown, ClipboardList, Clock3, Download, Gauge, History, LogOut,
  KeyRound, Mail, MapPin, Menu, Palmtree, PanelLeft, Plus, Settings, ShieldCheck, Smartphone, UserRound,
  Users, X, XCircle, Zap, Pencil, Search, ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react'
import { demoPassword, demoUsers, isSupabaseConfigured, readDemo, supabase, writeDemo } from './lib/supabase'
import { formatDate, formatTime, greetingLocal, hoursBetween, nowIso, todayLocal, yearLocal } from './lib/date'
import { getBrowserPosition, haversineDistance } from './lib/geo'
import { googleCalendarAction } from './lib/googleCalendar'
import JobCardsPage from './components/JobCardsPage'
import AppointmentsPage from './components/AppointmentsPage'
import { compressImage, normalizePlateNo } from './lib/jobCards'

const defaultSettings = { workshop_lat: 1.4927, workshop_lng: 103.7414, radius_m: 100 }
const STAFF_LEAVE_TYPES = ['MC', 'AL']
const ALL_LEAVE_TYPES = ['MC', 'AL', 'UPL']
const LOCAL_SNAPSHOT_VERSION = 'supabase-20261128'
const localSnapshotModules = import.meta.glob('./localSnapshot.js', { eager: true, import: 'localSnapshot' })
const localSnapshot = localSnapshotModules['./localSnapshot.js'] || {}

function sortProfiles(list) {
  return [...(list || [])].sort((a, b) => String(a.nickname || a.full_name || '').localeCompare(String(b.nickname || b.full_name || ''), 'en', { sensitivity: 'base' }))
}

function readLocalData(key, fallback) {
  if (isSupabaseConfigured) return readDemo(key, fallback)
  const currentVersion = readDemo('localSnapshotVersion', null)
  return currentVersion === LOCAL_SNAPSHOT_VERSION ? readDemo(key, localSnapshot[key] ?? fallback) : (localSnapshot[key] ?? fallback)
}

function leaveTypeLabel(type) {
  return { MC: 'MC', AL: 'AL · Annual Leave', UPL: 'UPL · Unpaid Leave' }[type] || type
}

function normalizeLeaveType(item) {
  return item?.type === 'EL' ? { ...item, type: 'AL' } : item
}

const seedBalances = () => [
  { id: 'bal-mc-demo', staff_id: 'demo-staff', year: yearLocal(), type: 'MC', limit_days: 14 },
  { id: 'bal-al-demo', staff_id: 'demo-staff', year: yearLocal(), type: 'AL', limit_days: 14 },
]
const seedAttendance = () => {
  const today = todayLocal()
  return [
    { id: 'att-1', staff_id: 'demo-staff', type: 'in', timestamp: `${today}T08:06:00+08:00`, lat: 1.4927, lng: 103.7414, distance_m: 12, edited: false },
    { id: 'att-2', staff_id: 'demo-staff', type: 'out', timestamp: `${today}T17:18:00+08:00`, lat: 1.4927, lng: 103.7414, distance_m: 16, edited: false },
    { id: 'att-3', staff_id: 'demo-staff', type: 'in', timestamp: `${todayLocal().slice(0, 8)}01T08:11:00+08:00`, lat: 1.4927, lng: 103.7414, distance_m: 31, edited: false },
  ]
}

const seedLeaves = () => [
  { id: 'leave-1', staff_id: 'demo-staff', type: 'MC', start_date: todayLocal(), end_date: todayLocal(), reason: 'Temu janji doktor', status: 'Pending', remark: '', attachment_name: '' },
]

const seedAppointments = () => [
  { id: 'appointment-demo-1', appointment_date: todayLocal(), customer_name: 'Faridz', plate_no: 'SJS1182H', car_model: 'Exora', job_description: 'Timing belt set CPS', status: 'Pending Review', created_by: 'demo-admin', updated_by: 'demo-admin', created_at: nowIso(), updated_at: nowIso() },
  { id: 'appointment-demo-2', appointment_date: todayLocal(), customer_name: 'Jacky', plate_no: 'JUL5801', car_model: 'X50', job_description: 'X50 timing belt + Upah HCA', status: 'Confirmed', created_by: 'demo-admin', updated_by: 'demo-admin', created_at: nowIso(), updated_at: nowIso() },
]

function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-electric text-ink hover:bg-white',
    secondary: 'border border-white/10 bg-white/5 text-white hover:bg-white/10',
    ghost: 'text-slate-300 hover:bg-white/5 hover:text-white',
    danger: 'border border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/20',
    lime: 'bg-lime text-ink hover:bg-white',
  }
  return <button className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-electric/70 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>
}

function Card({ children, className = '', ...props }) {
  return <section className={`min-w-0 rounded-[1.5rem] border border-white/10 bg-panel/80 p-4 shadow-glow backdrop-blur sm:p-5 ${className}`} {...props}>{children}</section>
}

function Badge({ children, tone = 'neutral' }) {
  const tones = { neutral: 'bg-white/10 text-slate-200', green: 'bg-lime/15 text-lime', amber: 'bg-ember/15 text-ember', red: 'bg-red-400/15 text-red-200', blue: 'bg-electric/15 text-electric' }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[tone]}`}>{children}</span>
}

function Logo({ compact = false }) {
  return <div className="flex items-center gap-3">
    <img src={compact ? '/logo-round.png' : '/logo-wide.png'} alt="Zordaq JB" className={compact ? 'h-11 w-11 rounded-full object-cover' : 'h-12 w-32 rounded-xl object-cover object-center'} />
    {!compact && <div className="hidden sm:block"><div className="text-sm font-black tracking-[.18em] text-white">MOTORSPORTS JB</div><div className="text-[10px] uppercase tracking-[.3em] text-electric">Workshop operating system</div></div>}
  </div>
}

function Field({ label, children, hint }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-200"><span>{label}</span>{children}{hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}</label>
}

function Input({ className = '', ...props }) {
  return <input className={`min-h-11 w-full rounded-2xl border border-white/10 bg-ink/60 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-electric/70 focus:ring-2 focus:ring-electric/20 ${className}`} {...props} />
}

function Select({ children, className = '', ...props }) {
  return <select className={`min-h-11 w-full rounded-2xl border border-white/10 bg-ink/60 px-3.5 text-sm text-white outline-none focus:border-electric/70 ${className}`} {...props}>{children}</select>
}

function Empty({ icon: Icon = CalendarDays, title, text }) {
  return <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-10 text-center"><Icon className="mb-3 text-slate-600" size={28} /><div className="font-semibold text-slate-300">{title}</div><div className="mt-1 max-w-xs text-sm text-slate-500">{text}</div></div>
}

function AuthScreen({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', nickname: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const updateType = (event) => setForm((prev) => ({ ...prev, type: event.target.value, status: event.target.value === 'UPL' ? 'Approved' : prev.status }))

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (isSupabaseConfigured) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (authError) throw authError
        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
        if (profileError) throw profileError
        if (!profile.is_active) { await supabase.auth.signOut(); throw new Error('This account has been deactivated by an admin.') }
        onLogin(profile)
      } else {
        const user = demoUsers.find((item) => item.email.toLowerCase() === form.email.toLowerCase() && item.is_active)
        const passwordOverrides = readDemo('passwordOverrides', {})
        if (!user || form.password !== (passwordOverrides[user.id] || demoPassword)) throw new Error('Demo email or password is incorrect.')
        onLogin(user)
      }
    } catch (err) { setError(err.message || 'Something went wrong. Try again.') } finally { setBusy(false) }
  }

  return <main className="grid min-h-screen place-items-center overflow-hidden bg-ink px-4 py-8 text-white">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(124,156,255,.2),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(185,239,112,.1),transparent_26%)]" />
    <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-panel/80 shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
      <div className="hidden min-h-[650px] flex-col justify-between bg-ink p-10 lg:flex">
        <div><Logo /><div className="mt-24 max-w-sm"><p className="mb-4 text-xs font-bold uppercase tracking-[.3em] text-lime">Cleaner workshop operations</p><h1 className="text-5xl font-black leading-[.98]">Work faster.<br />Clear records.</h1><p className="mt-5 text-slate-300">Staff attendance and leave for Zordaq Motorsports JB, in one place.</p></div></div>
        <div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15} className="text-lime" /> Role-based access · Malaysia time</div>
      </div>
      <div className="p-6 sm:p-10"><div className="mb-8 lg:hidden"><Logo compact /></div><div className="mb-8"><Badge tone="blue">ZORDAQ JB · {isSupabaseConfigured ? 'LIVE' : 'DEMO'}</Badge><h2 className="mt-4 text-3xl font-black">Welcome back.</h2><p className="mt-2 text-sm text-slate-400">Sign in to continue today's operations. Staff accounts are created by admin invitation only.</p></div>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Email"><Input required type="email" value={form.email} onChange={update('email')} placeholder="name@zordaqjb.my" /></Field>
          <Field label="Password"><Input required type="password" value={form.password} onChange={update('password')} placeholder="••••••••" minLength={6} /></Field>
          {error && <div className={`rounded-2xl border px-3 py-3 text-sm ${error.startsWith('Check') ? 'border-lime/20 bg-lime/10 text-lime' : 'border-red-300/20 bg-red-400/10 text-red-100'}`}><AlertCircle className="mr-2 inline" size={15} />{error}</div>}
          <Button disabled={busy} className="mt-2 w-full">{busy ? 'Please wait…' : 'Sign in to dashboard'} <ArrowRight size={17} /></Button>
        </form>
        {!isSupabaseConfigured && <div className="mt-5 rounded-2xl border border-electric/20 bg-electric/10 p-3 text-xs text-slate-300"><b className="text-electric">Demo mode:</b> admin `paan@zordaq.my` or staff `staff@zordaq.my` · password `12345678`</div>}
      </div>
    </div>
  </main>
}

function InviteSetupScreen({ onComplete }) {
  const [form, setForm] = useState({ full_name: '', nickname: '', password: '', confirm_password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setError('')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    if (form.password !== form.confirm_password) return setError('Passwords do not match.')
    if (!form.full_name.trim() || !form.nickname.trim()) return setError('Full name and nickname are required.')
    setBusy(true)
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({ password: form.password, data: { full_name: form.full_name.trim(), nickname: form.nickname.trim() } })
      if (updateError) throw updateError
      const { data: profile, error: profileError } = await supabase.from('profiles').update({ full_name: form.full_name.trim(), nickname: form.nickname.trim() }).eq('id', data.user.id).select().single()
      if (profileError) throw profileError
      window.history.replaceState({}, '', window.location.pathname)
      onComplete(profile)
    } catch (err) { setError(err.message || 'The invitation link could not be verified.') } finally { setBusy(false) }
  }
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  return <main className="grid min-h-screen place-items-center overflow-hidden bg-ink px-4 py-8 text-white"><div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(124,156,255,.2),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(185,239,112,.1),transparent_26%)]" /><div className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-panel/90 p-6 shadow-2xl sm:p-10"><div className="mb-8"><Logo compact /><Badge tone="blue">STAFF INVITATION</Badge><h1 className="mt-4 text-3xl font-black">Complete your account.</h1><p className="mt-2 text-sm text-slate-400">Complete these details to start using Zordaq Motorsports JB.</p></div><form onSubmit={submit} className="grid gap-4"><Field label="Full name"><Input required value={form.full_name} onChange={update('full_name')} placeholder="Example: Aiman Hakimi" /></Field><Field label="Nickname"><Input required value={form.nickname} onChange={update('nickname')} placeholder="Example: Aiman" /></Field><Field label="Password"><Input required type="password" minLength={6} value={form.password} onChange={update('password')} placeholder="Minimum 6 characters" /></Field><Field label="Confirm password"><Input required type="password" minLength={6} value={form.confirm_password} onChange={update('confirm_password')} placeholder="Enter your password again" /></Field>{error && <div className="rounded-2xl border border-red-300/20 bg-red-400/10 px-3 py-3 text-sm text-red-100"><AlertCircle className="mr-2 inline" size={15} />{error}</div>}<Button disabled={busy} className="mt-2 w-full">{busy ? 'Setting up account…' : 'Activate account'} <ArrowRight size={17} /></Button></form></div></main>
}

function Sidebar({ user, active, setActive, onSignOut, open, setOpen }) {
  const accountLink = { id: 'account', label: 'Account', icon: KeyRound }
  const staffLinks = [{ id: 'dashboard', label: 'Today', icon: Gauge }, { id: 'appointments', label: 'Appointments', icon: CalendarRange }, { id: 'job-cards', label: 'Job Cards', icon: ClipboardList }, { id: 'vehicle-history', label: 'Vehicle History', icon: History }, { id: 'leave', label: 'My Leave', icon: Palmtree }, accountLink]
  const adminLinks = [{ id: 'overview', label: 'Overview', icon: Gauge }, { id: 'appointments', label: 'Appointments', icon: CalendarRange }, { id: 'job-cards', label: 'Job Cards', icon: ClipboardList }, { id: 'vehicle-history', label: 'Vehicle History', icon: History }, { id: 'people', label: 'Staff', icon: Users }, { id: 'attendance', label: 'Attendance', icon: Clock3 }, { id: 'leave-admin', label: 'Leave Requests', icon: Palmtree }, { id: 'settings', label: 'Settings', icon: Settings }, accountLink]
  const links = user.role === 'admin' ? adminLinks : staffLinks
  return <><div className={`fixed inset-0 z-30 bg-black/50 transition lg:hidden ${open ? 'visible opacity-100' : 'invisible opacity-0'}`} onClick={() => setOpen(false)} /><aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-ink p-4 transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className="flex items-center justify-between px-2 py-2"><Logo compact /><button className="rounded-xl p-2 text-slate-500 lg:hidden" onClick={() => setOpen(false)}><X size={18} /></button></div>
    <div className="mt-10 px-2"><div className="mb-3 text-[10px] font-bold uppercase tracking-[.25em] text-slate-600">Main menu</div><nav className="grid gap-1">{links.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setActive(id); setOpen(false) }} className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold transition ${active === id ? 'bg-electric text-ink' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon size={18} />{label}</button>)}</nav></div>
    <div className="mt-auto rounded-2xl border border-white/10 bg-panel p-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-electric/15 text-sm font-black text-electric">{user.nickname?.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-white">{user.nickname}</div><div className="text-xs capitalize text-slate-500">{user.role}</div></div></div><button className="mt-3 flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white" onClick={onSignOut}><LogOut size={16} /> Sign out</button></div>
  </aside></>
}

function Header({ user, title, onMenu }) {
  return <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-8"><div className="flex items-center gap-3"><button className="rounded-xl p-2 text-slate-400 hover:bg-white/5 lg:hidden" onClick={onMenu}><Menu size={20} /></button><div><div className="text-xs font-medium text-slate-500">{new Intl.DateTimeFormat('en-MY', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())}</div><h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h1></div></div><div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 sm:flex"><span className="h-2 w-2 rounded-full bg-lime shadow-[0_0_10px_#b9ef70]" /> {user.nickname} · {user.role === 'admin' ? 'Owner' : 'Staff'}</div></header>
}

function ClockCard({ user, settings, attendance, onClock, notice }) {
  const [greeting, setGreeting] = useState(() => greetingLocal())
  const own = attendance.filter((item) => item.staff_id === user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const clockedIn = own[0]?.type === 'in'
  const lastIn = own.find((item) => item.type === 'in')
  const lastOut = own.find((item) => item.type === 'out')
  useEffect(() => {
    const updateGreeting = () => setGreeting(greetingLocal())
    const interval = window.setInterval(updateGreeting, 60_000)
    return () => window.clearInterval(interval)
  }, [])
  return <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(124,156,255,.16),rgba(18,26,53,.8)_45%)]"><div className="flex items-start justify-between gap-3"><div><Badge tone={clockedIn ? 'green' : 'neutral'}>{clockedIn ? 'Working' : 'Not clocked in'}</Badge><h2 className="mt-3 text-2xl font-black text-white">{clockedIn ? 'Remember to clock out.' : `${greeting}, `}{!clockedIn && <span className="text-electric">{user.nickname}.</span>}</h2><p className="mt-2 text-sm text-slate-400">{clockedIn ? `Clock in ${formatTime(lastIn?.timestamp)} · radius ${lastIn?.distance_m ?? '—'}m` : 'Record your work time for today.'}</p></div><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-electric/15 text-electric"><MapPin size={21} /></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Button variant={clockedIn ? 'secondary' : 'lime'} disabled={Boolean(clockedIn) || notice?.busy} onClick={() => onClock('in')} className="min-h-16 text-base"><MapPin size={20} /> Clock In</Button><Button variant={!clockedIn ? 'secondary' : 'primary'} disabled={!clockedIn || notice?.busy} onClick={() => onClock('out')} className="min-h-16 text-base"><Clock3 size={20} /> Clock Out</Button></div><div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span>Last clock in <b className="text-slate-300">{formatTime(lastIn?.timestamp)}</b></span><span>Last clock out <b className="text-slate-300">{formatTime(lastOut?.timestamp)}</b></span><span className="inline-flex items-center gap-1"><Smartphone size={13} /> GPS radius {settings.radius_m}m</span></div>{notice?.message && <div className={`mt-4 rounded-2xl border px-3 py-3 text-sm ${notice.type === 'error' ? 'border-red-300/20 bg-red-400/10 text-red-100' : 'border-lime/20 bg-lime/10 text-lime'}`}>{notice.message}</div>}</Card>
}

function StatCard({ label, value, hint, tone = 'blue', icon: Icon, onClick }) {
  return <Card onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } } : undefined} className={`relative overflow-hidden ${onClick ? 'cursor-pointer transition hover:border-electric/40 focus:outline-none focus:ring-2 focus:ring-electric/60' : ''}`}><div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${tone === 'green' ? 'bg-lime/20' : tone === 'amber' ? 'bg-ember/20' : 'bg-electric/20'}`} /><div className="relative flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-3 text-3xl font-black text-white">{value}</div><div className="mt-1 text-xs text-slate-500">{hint}</div></div><Icon className="text-slate-500" size={18} /></div></Card>
}

function StaffDashboard({ user, attendance, settings, leaves, balances, appointments, jobCards, onClock, notice, setActive }) {
  const own = attendance.filter((item) => item.staff_id === user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const activeJobCards = jobCards.filter((item) => item.status !== 'Collected').length
  const todaysAppointments = appointments.filter((item) => item.appointment_date === todayLocal()).length
  return <div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><StatCard label="Days present this month" value="1" hint="From attendance records" icon={CalendarDays} /><StatCard label="Job Card" value={activeJobCards} hint="Open job cards · Click to view" icon={ClipboardList} onClick={() => setActive('job-cards')} /></div><StatCard label="Today's Appointment" value={todaysAppointments} hint="Scheduled today · Open calendar" icon={CalendarRange} onClick={() => setActive('appointments')} /><ClockCard user={user} settings={settings} attendance={attendance} onClock={onClock} notice={notice} /><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><Card><div className="flex items-center justify-between"><div><h3 className="font-bold text-white">Recent activity</h3><p className="mt-1 text-xs text-slate-500">Your personal records</p></div><button onClick={() => setActive('leave')} className="text-xs font-bold text-electric hover:text-white">View leave <ArrowRight className="ml-1 inline" size={13} /></button></div><div className="mt-5 grid gap-2">{own.slice(0, 4).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] p-3"><div className={`grid h-9 w-9 place-items-center rounded-xl ${item.type === 'in' ? 'bg-lime/10 text-lime' : 'bg-electric/10 text-electric'}`}>{item.type === 'in' ? <ArrowRight size={16} /> : <LogOut size={16} />}</div><div className="flex-1"><div className="text-sm font-semibold text-slate-200">Clock {item.type === 'in' ? 'In' : 'Out'}</div><div className="text-xs text-slate-500">{formatDate(item.timestamp)} · GPS {item.distance_m}m</div></div><div className="text-sm font-bold text-white">{formatTime(item.timestamp)}</div></div>)}{!own.length && <Empty title="No records yet" text="Clock in to start recording your day." />}</div></Card><Card><div className="flex items-center justify-between"><div><h3 className="font-bold text-white">Leave balance</h3><p className="mt-1 text-xs text-slate-500">Year {yearLocal()}</p></div><button onClick={() => setActive('leave')} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300"><Plus size={17} /></button></div><div className="mt-5 grid gap-3">{STAFF_LEAVE_TYPES.map((type) => { const item = getBalance(leaves, user.id, type, balances); return <div key={type} className="rounded-2xl border border-white/10 p-3"><div className="flex items-center justify-between text-sm"><span className="font-bold text-white">{type}</span><span className="text-slate-400">{item.used} / {item.limit} days</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-electric" style={{ width: `${Math.min(100, (item.used / Math.max(1, item.limit)) * 100)}%` }} /></div><div className="mt-2 text-xs text-slate-500">Baki {item.remaining} days</div></div> })}</div></Card></div></div>
}

function getBalance(leaves, staffId, type, balances = []) {
  if (type === 'UPL') return { limit: null, used: 0, remaining: null }
  const limit = balances.find((item) => item.staff_id === staffId && item.year === yearLocal() && item.type === type)?.limit_days ?? 14
  const used = leaves.filter((item) => item.staff_id === staffId && item.type === type && item.status === 'Approved').reduce((total, item) => total + dateDays(item.start_date, item.end_date), 0)
  return { limit, used, remaining: Math.max(0, limit - used) }
}

function dateDays(start, end) {
  if (!start || !end) return 0
  return Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 864e5) + 1
}

function hasApprovedLeaveOnDate(leaves, staffId, date) {
  return leaves.some((item) => item.staff_id === staffId && item.status === 'Approved' && item.start_date <= date && item.end_date >= date)
}

function hasActiveLeaveOverlap(leaves, staffId, startDate, endDate) {
  return leaves.some((item) => item.staff_id === staffId && item.status !== 'Rejected' && item.start_date <= endDate && item.end_date >= startDate)
}

function LeavePage({ user, leaves, balances, onSubmit, onCancel }) {
  const [form, setForm] = useState({ type: 'MC', start_date: todayLocal(), end_date: todayLocal(), reason: '', attachment: null })
  const [error, setError] = useState('')
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.type === 'file' ? event.target.files[0] : event.target.value }))
  const own = leaves.filter((item) => item.staff_id === user.id)
  async function submit(event) { event.preventDefault(); setError(''); const result = await onSubmit(form); if (result?.error) setError(result.error); else setForm({ type: 'MC', start_date: todayLocal(), end_date: todayLocal(), reason: '', attachment: null }) }
  return <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><div className="grid gap-5"><Card><div className="flex items-start justify-between"><div><Badge tone="blue">Year {yearLocal()}</Badge><h2 className="mt-3 text-xl font-black text-white">My leave balance</h2><p className="mt-1 text-sm text-slate-500">Approved MC and AL applications are deducted automatically.</p></div><Palmtree className="text-lime" size={22} /></div><div className="mt-5 grid grid-cols-2 gap-3">{STAFF_LEAVE_TYPES.map((type) => { const item = getBalance(leaves, user.id, type, balances); return <div key={type} className="rounded-2xl bg-white/[.04] p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{type === 'AL' ? 'AL · Annual Leave' : type}</div><div className="mt-2 text-2xl font-black text-white">{item.remaining}<span className="ml-1 text-sm font-medium text-slate-500">days</span></div><div className="mt-1 text-xs text-slate-500">Used {item.used} / {item.limit}</div></div> })}</div></Card><Card><div className="mb-4"><h3 className="font-bold text-white">Apply for leave</h3><p className="mt-1 text-xs text-slate-500">Submit an MC or AL application with the correct dates.</p></div><form onSubmit={submit} className="grid gap-4"><Field label="Leave type"><Select value={form.type} onChange={update('type')}><option value="MC">MC</option><option value="AL">AL · Annual Leave</option></Select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Start date"><Input type="date" value={form.start_date} onChange={update('start_date')} required /></Field><Field label="End date"><Input type="date" value={form.end_date} onChange={update('end_date')} required /></Field></div><Field label="Reason"><textarea value={form.reason} onChange={update('reason')} required rows="3" className="w-full resize-none rounded-2xl border border-white/10 bg-ink/60 p-3.5 text-sm text-white outline-none focus:border-electric/70" placeholder="Example: fever and need to rest" /></Field><Field label="Supporting document" hint="Optional · image or PDF"><Input type="file" accept="image/*,.pdf" onChange={update('attachment')} className="file:mr-3 file:rounded-lg file:border-0 file:bg-electric/20 file:px-2 file:py-1 file:text-xs file:font-bold file:text-electric" /></Field>{error && <div className="rounded-2xl bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}<Button type="submit" className="w-full"><Plus size={17} /> Submit application</Button></form></Card></div><Card><div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-white">Leave history</h2><p className="mt-1 text-sm text-slate-500">Status, UPL details, and remarks from admin.</p></div><CalendarDays className="text-electric" size={22} /></div><div className="mt-5 grid gap-3">{own.map((item) => <div key={item.id} className="rounded-2xl border border-white/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-white">{leaveTypeLabel(item.type)}</span><Badge tone={item.status === 'Approved' ? 'green' : item.status === 'Rejected' ? 'red' : 'amber'}>{item.status === 'Approved' ? 'Approved' : item.status === 'Rejected' ? 'Rejected' : 'Pending'}</Badge></div><div className="mt-2 text-sm text-slate-300">{formatDate(item.start_date)} — {formatDate(item.end_date)}</div><div className="mt-1 text-sm text-slate-500">{item.reason}</div></div><div className="text-right text-xs text-slate-500">{dateDays(item.start_date, item.end_date)} days</div></div>{item.remark && <div className="mt-3 rounded-xl bg-white/[.04] p-3 text-xs text-slate-400">Admin remark: {item.remark}</div>}{item.attachment_name && <div className="mt-3 text-xs text-electric">Attachment: {item.attachment_name}</div>}{item.status === 'Pending' && <Button variant="danger" className="mt-4 min-h-9" onClick={() => onCancel(item.id)}><XCircle size={15} /> Cancel</Button>}</div>)}{!own.length && <Empty title="No leave records yet" text="When you need leave, submit an application using the form." />}</div></Card></div>
}

function AdminOverview({ users, attendance, leaves, appointments, setActive }) {
  const staff = users.filter((item) => item.role === 'staff' && item.is_active)
  const pending = leaves.filter((item) => item.status === 'Pending').length
  const present = staff.filter((person) => attendance.filter((item) => item.staff_id === person.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.type === 'in').length
  const todaysAppointments = appointments.filter((item) => item.appointment_date === todayLocal()).length
  return <div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Active staff" value={staff.length} hint="Active accounts" icon={Users} /><StatCard label="Working" value={present} hint="Clocked in, not out" tone="green" icon={Zap} /><StatCard label="Pending leave" value={pending} hint="Needs action · Open leave requests" tone="amber" icon={Palmtree} onClick={() => setActive('leave-admin')} /><StatCard label="Today's appointment" value={todaysAppointments} hint="Scheduled today · Open calendar" icon={CalendarRange} onClick={() => setActive('appointments')} /></div><div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]"><Card><div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-white">Today's status</h2><p className="mt-1 text-sm text-slate-500">Operations overview by staff.</p></div><Button variant="secondary" onClick={() => setActive('attendance')}>Open report <ArrowRight size={15} /></Button></div><div className="mt-5 grid gap-2">{staff.map((person) => { const last = attendance.filter((item) => item.staff_id === person.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; const onLeave = leaves.some((item) => item.staff_id === person.id && item.status === 'Approved' && item.start_date <= todayLocal() && item.end_date >= todayLocal()); return <div key={person.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] p-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-electric/15 font-black text-electric">{person.nickname.slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="font-semibold text-white">{person.nickname}</div><div className="text-xs text-slate-500">{person.full_name}</div></div>{onLeave ? <Badge tone="blue">On leave</Badge> : last?.type === 'in' ? <Badge tone="green">Working · {formatTime(last.timestamp)}</Badge> : last?.type === 'out' ? <Badge tone="blue">Clocked Out - {formatTime(last.timestamp)}</Badge> : <Badge tone="neutral">Not clocked in</Badge>}</div> })}{!staff.length && <Empty title="No staff yet" text="Staff accounts will appear here." />}</div></Card><Card><h3 className="font-bold text-white">Quick actions</h3><div className="mt-4 grid gap-2"><Button variant="secondary" className="justify-start" onClick={() => setActive('leave-admin')}><Palmtree size={17} /> Review pending leave</Button><Button variant="secondary" className="justify-start" onClick={() => setActive('attendance')}><Download size={17} /> Export CSV</Button><Button variant="secondary" className="justify-start" onClick={() => setActive('settings')}><Settings size={17} /> Review workshop location</Button></div><div className="mt-6 rounded-2xl bg-lime/10 p-4"><div className="flex items-center gap-2 text-sm font-bold text-lime"><ShieldCheck size={16} /> Admin access active</div><p className="mt-2 text-xs leading-relaxed text-slate-400">All record edits require a reason and are recorded in the audit log.</p></div></Card></div></div>
}

function StaffBalanceCell({ person, type, leaves, balances, onBalanceSave }) {
  const balance = getBalance(leaves, person.id, type, balances)
  return <div className="grid gap-1"><div className="font-bold text-white">{balance.remaining} days</div><div className="text-xs text-slate-500">Used {balance.used} / {balance.limit}</div><Input aria-label={`${person.nickname} ${type} annual limit`} className="min-h-9 !w-[5.25rem] px-1 text-center" type="number" min="0" defaultValue={balance.limit} onBlur={(e) => onBalanceSave(person.id, type, e.target.value)} /></div>
}

function PeoplePage({ users, leaves, balances, onToggle, onBalanceSave, onEdit, onInvite }) {
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteError, setInviteError] = useState('')
  function openEditor(person) { setError(''); setEditor({ id: person.id, role: person.role, full_name: person.full_name, nickname: person.nickname, email: person.email, password: '', confirm_password: '' }) }
  async function submitEditor(event) {
    event.preventDefault(); setError(''); setBusy(true)
    const result = await onEdit(editor)
    if (result?.error) setError(result.error); else setEditor(null)
    setBusy(false)
  }
  async function submitInvite(event) {
    event.preventDefault(); setInviteMessage(''); setInviteError('')
    if (!inviteEmail.trim()) return setInviteError('Enter the staff email first.')
    setInviteBusy(true)
    const result = await onInvite(inviteEmail.trim().toLowerCase())
    if (result?.error) setInviteError(result.error); else { setInviteMessage(result?.message || 'Invitation link sent successfully.'); setInviteEmail('') }
    setInviteBusy(false)
  }
  return <div className="grid gap-5"><Card className="border-electric/20 bg-[linear-gradient(135deg,rgba(124,156,255,.14),rgba(18,26,53,.82)_60%)]"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-electric/15 text-electric"><Mail size={20} /></div><div><Badge tone="blue">Invite staff</Badge><h2 className="mt-3 text-xl font-black text-white">Send a registration link by email</h2><p className="mt-1 max-w-xl text-sm text-slate-400">Staff can no longer register from the main page. Enter an email and they will complete their name and password through the invitation link.</p></div></div><form onSubmit={submitInvite} className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl"><Input aria-label="Staff invitation email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="staff@example.com" /><Button disabled={inviteBusy} className="shrink-0"><Mail size={16} /> {inviteBusy ? 'Sending…' : 'Send registration link'}</Button></form></div>{inviteMessage && <div className="mt-4 rounded-2xl border border-lime/20 bg-lime/10 px-3 py-3 text-sm text-lime">{inviteMessage}</div>}{inviteError && <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-400/10 px-3 py-3 text-sm text-red-100">{inviteError}</div>}</Card><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">Staff</h2><p className="mt-1 text-sm text-slate-500">Manage staff access and current MC/AL balances.</p></div><Badge tone="blue">{users.filter((item) => item.role === 'staff').length} staff</Badge></div><div className="mt-5 overflow-x-auto"><table className="w-max whitespace-nowrap text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3 pr-[10px]">Name</th><th className="pb-3">MC balance</th><th className="pb-3">AL balance</th><th className="pb-3">Status</th><th className="pb-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/5">{users.map((person) => <tr key={person.id}><td className="py-4 pr-[10px]"><div className="font-bold text-white">{person.nickname}</div><div className="text-xs capitalize text-slate-500">{person.role}</div></td><td className="py-4">{person.role === 'staff' && <StaffBalanceCell person={person} type="MC" leaves={leaves} balances={balances} onBalanceSave={onBalanceSave} />}</td><td className="py-4">{person.role === 'staff' && <StaffBalanceCell person={person} type="AL" leaves={leaves} balances={balances} onBalanceSave={onBalanceSave} />}</td><td className="py-4"><Badge tone={person.is_active ? 'green' : 'red'}>{person.is_active ? 'Active' : 'Deactivated'}</Badge></td><td className="py-4 text-right"><div className="flex justify-end gap-2">{<Button variant="secondary" className="min-h-9" onClick={() => openEditor(person)}><Pencil size={14} /> Edit</Button>}{person.role === 'staff' && <Button variant={person.is_active ? 'danger' : 'secondary'} className="min-h-9" onClick={() => onToggle(person.id)}>{person.is_active ? 'Deactivate' : 'Activate'}</Button>}</div></td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-slate-500">Baki dikira daripada had tahunan selepas cuti Approved. Ubah had di ruangan nombor dan tinggalkan field untuk simpan.</p></Card>{editor && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><Card className="w-full max-w-lg"><div className="flex items-start justify-between"><div><Badge tone="blue">Staff profile</Badge><h2 className="mt-3 text-xl font-black text-white">Edit staff details</h2><p className="mt-1 text-sm text-slate-500">Changes are saved directly to the profile.</p></div><button onClick={() => setEditor(null)} className="rounded-xl p-2 text-slate-500 hover:bg-white/5"><X size={18} /></button></div><form onSubmit={submitEditor} className="mt-5 grid gap-4"><Field label="Full name"><Input required value={editor.full_name} onChange={(e) => setEditor({ ...editor, full_name: e.target.value })} /></Field><Field label="Nickname"><Input required value={editor.nickname} onChange={(e) => setEditor({ ...editor, nickname: e.target.value })} /></Field><Field label="Login email" hint="The Auth email must be changed through account recovery; this field is locked here."><Input value={editor.email} readOnly className="cursor-not-allowed opacity-60" /></Field>{editor.role === 'staff' && <><Field label="New password for staff" hint="Optional. Leave blank to keep the current password."><Input type="password" minLength={6} value={editor.password} onChange={(e) => setEditor({ ...editor, password: e.target.value })} placeholder="Minimum 6 characters" /></Field><Field label="Confirm new password"><Input type="password" minLength={6} value={editor.confirm_password} onChange={(e) => setEditor({ ...editor, confirm_password: e.target.value })} /></Field></>}{error && <div className="rounded-2xl bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}<div className="flex gap-2"><Button type="button" variant="secondary" className="flex-1" onClick={() => setEditor(null)}>Cancel</Button><Button type="submit" className="flex-1" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button></div></form></Card></div>}</div>
}

function attendanceDateKey(value) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function attendanceTimeValue(value) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
}

function shiftAttendanceDate(value, amount) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + amount))
  return date.toISOString().slice(0, 10)
}

function attendanceDayOfWeek(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function attendanceDateLabel(value, options = {}) {
  return new Intl.DateTimeFormat('en-MY', { timeZone: 'Asia/Kuala_Lumpur', ...options }).format(new Date(`${value}T00:00:00+08:00`))
}

function attendanceDuration(hours) {
  const minutes = Math.max(0, Math.round(hours * 60))
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

function recordsForStaffDay(records, staffId, date) {
  return records.filter((item) => item.staff_id === staffId && attendanceDateKey(item.timestamp) === date).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

function attendanceSummary(records, date) {
  let totalHours = 0
  let openIn = null
  let lastIn = null
  let lastOut = null
  records.forEach((item) => {
    if (item.type === 'in') { openIn = item; lastIn = item }
    if (item.type === 'out' && openIn) { totalHours += hoursBetween(openIn.timestamp, item.timestamp); lastOut = item; openIn = null }
  })
  const ongoing = openIn && date === todayLocal()
  if (ongoing) totalHours += hoursBetween(openIn.timestamp, nowIso())
  return { totalHours, openIn, lastIn, lastOut, ongoing, hasIn: records.some((item) => item.type === 'in') }
}

function AttendancePage({ users, attendance, leaves, onSave, onDelete }) {
  const [range, setRange] = useState('weekly')
  const [selectedDate, setSelectedDate] = useState(todayLocal())
  const [selectedMonth, setSelectedMonth] = useState(todayLocal().slice(0, 7))
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState(null)
  const staff = users.filter((item) => item.role === 'staff')
  const weekStart = shiftAttendanceDate(selectedDate, -((attendanceDayOfWeek(selectedDate) + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, index) => shiftAttendanceDate(weekStart, index))
  const monthDays = Number(selectedMonth.split('-')[1]) === 12 ? 31 : new Date(Date.UTC(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0)).getUTCDate()
  const monthStart = `${selectedMonth}-01`
  const monthEnd = `${selectedMonth}-${String(monthDays).padStart(2, '0')}`
  const calendarOffset = (attendanceDayOfWeek(monthStart) + 6) % 7
  const calendarDays = Array.from({ length: calendarOffset + monthDays }, (_, index) => index < calendarOffset ? null : shiftAttendanceDate(monthStart, index - calendarOffset))
  const activeStaff = staff.filter((person) => `${person.nickname} ${person.full_name}`.toLowerCase().includes(search.toLowerCase().trim()))
  const visibleRecords = [...attendance].filter((item) => range === 'monthly' ? attendanceDateKey(item.timestamp) >= monthStart && attendanceDateKey(item.timestamp) <= monthEnd : attendanceDateKey(item.timestamp) === selectedDate).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const scopedRecords = visibleRecords.filter((item) => activeStaff.some((person) => person.id === item.staff_id))

  function openEditor(item) {
    setEditor(item
      ? { ...item, date: attendanceDateKey(item.timestamp), time: attendanceTimeValue(item.timestamp), reason: '' }
      : { staff_id: staff[0]?.id || '', type: 'in', date: selectedDate, time: '08:00', reason: '' })
  }

  function submit(event) {
    event.preventDefault()
    if (!editor.reason.trim()) return
    onSave({ ...editor, timestamp: `${editor.date}T${editor.time}:00+08:00` })
    setEditor(null)
  }

  function moveWeek(amount) { setSelectedDate(shiftAttendanceDate(selectedDate, amount * 7)) }
  function moveMonth(amount) {
    const [year, month] = selectedMonth.split('-').map(Number)
    const next = new Date(Date.UTC(year, month - 1 + amount, 1))
    setSelectedMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  function monthlyStaffStatus(person, date) {
    const approvedLeave = leaves.some((item) => item.staff_id === person.id && item.status === 'Approved' && item.start_date <= date && item.end_date >= date)
    if (date > todayLocal()) return approvedLeave ? 'leave' : null
    if (approvedLeave) return 'leave'
    return recordsForStaffDay(attendance, person.id, date).some((item) => item.type === 'in') ? 'present' : 'absent'
  }

  const csvRows = scopedRecords.map((item) => [users.find((u) => u.id === item.staff_id)?.full_name || '', item.type === 'in' ? 'Clock In' : 'Clock Out', formatDate(item.timestamp), formatTime(item.timestamp), item.distance_m, item.edited ? 'Edited by admin' : 'Original'])
  return <div className="grid gap-5">
    <Card>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><Badge tone="blue">Admin attendance</Badge><h2 className="mt-3 text-xl font-black text-white">Attendance report</h2><p className="mt-1 text-sm text-slate-500">View staff attendance by week or month in Malaysia time.</p></div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto"><div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">{[['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([value, label]) => <button key={value} onClick={() => setRange(value)} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${range === value ? 'bg-electric text-ink' : 'text-slate-400 hover:text-white'}`}>{label}</button>)}</div><Button onClick={() => openEditor()}><Plus size={16} /> Add</Button></div>
      </div>

      {range === 'weekly' && <>
        <div className="mt-6 flex items-center justify-between gap-2"><button className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => moveWeek(-1)} aria-label="Previous week"><ChevronLeft size={19} /></button><div className="text-center text-sm font-bold text-white">{attendanceDateLabel(weekDays[0], { day: 'numeric', month: 'short' })} — {attendanceDateLabel(weekDays[6], { day: 'numeric', month: 'short', year: 'numeric' })}</div><button className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => moveWeek(1)} aria-label="Next week"><ChevronRight size={19} /></button></div>
        <div className="mt-4 grid grid-cols-7 gap-1 border-b border-white/10 pb-5 sm:gap-2">{weekDays.map((date) => { const isSelected = date === selectedDate; return <button key={date} onClick={() => setSelectedDate(date)} className={`rounded-2xl px-1 py-3 text-center transition ${isSelected ? 'bg-electric text-ink shadow-lg shadow-electric/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><div className="text-[10px] font-bold uppercase tracking-wide sm:text-xs">{attendanceDateLabel(date, { weekday: 'short' })}</div><div className={`mx-auto mt-2 grid h-9 w-9 place-items-center rounded-full text-lg font-black ${isSelected ? 'bg-ink text-white' : 'text-slate-200'}`}>{attendanceDateLabel(date, { day: 'numeric' })}</div></button> })}</div>
      </>}

      {range === 'monthly' && <div className="mt-6 flex items-center justify-between gap-2"><button className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={19} /></button><div className="text-center"><div className="text-lg font-black text-white">{attendanceDateLabel(monthStart, { month: 'long', year: 'numeric' })}</div><div className="mt-1 text-xs text-slate-500">{monthDays} days in this month</div></div><button className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={19} /></button></div>}

      <div className="relative mt-5"><Search className="absolute left-3.5 top-3.5 text-slate-500" size={18} /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-11" placeholder="Search staff name" /></div>
    </Card>

    {range !== 'monthly' && <Card><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold text-white">{attendanceDateLabel(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h3><p className="mt-1 text-xs text-slate-500">{activeStaff.length} staff · attendance status for the selected day</p></div><CalendarDays className="text-electric" size={20} /></div><div className="divide-y divide-white/10">{activeStaff.map((person) => { const records = recordsForStaffDay(attendance, person.id, selectedDate); const summary = attendanceSummary(records, selectedDate); const approvedLeave = leaves.find((item) => item.staff_id === person.id && item.status === 'Approved' && item.start_date <= selectedDate && item.end_date >= selectedDate); const onLeave = Boolean(approvedLeave); const status = onLeave ? leaveTypeLabel(approvedLeave.type) : summary.hasIn ? summary.ongoing ? `${attendanceTimeValue(summary.lastIn.timestamp)} · Ongoing` : `${attendanceTimeValue(summary.lastIn.timestamp)}${summary.lastOut ? ` — ${attendanceTimeValue(summary.lastOut.timestamp)}` : ' · No clock out'}` : 'Did not clock in'; const duration = onLeave ? '' : summary.totalHours ? attendanceDuration(summary.totalHours) : ''; return <div key={person.id} className="flex items-center gap-3 py-4 sm:gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-electric/15 text-base font-black text-electric">{person.nickname?.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-base font-semibold text-white sm:text-lg">{person.full_name}</div><div className={`mt-1 text-sm ${onLeave ? 'text-electric' : summary.hasIn ? 'text-slate-400' : 'text-slate-500'}`}>{status}</div></div><div className="flex items-center gap-2 sm:gap-4">{duration && <div className="text-right text-sm font-bold text-white sm:text-lg">{duration}</div>}{records.length > 0 && <button className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white" onClick={() => openEditor(records[records.length - 1])} title="Edit latest attendance record"><Pencil size={15} /></button>}<ChevronRight className="text-slate-600" size={20} /></div></div> })}{!activeStaff.length && <Empty title="No staff found" text="Try another name." />}{activeStaff.length === 0 && !staff.length && <Empty title="No staff yet" text="Staff accounts will appear here." />}</div></Card>}

    {range === 'monthly' && <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-white">Monthly attendance</h3><p className="mt-1 text-xs text-slate-500">Staff names are shown only when the selected date has an attendance or approved leave status.</p></div><div className="flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded-full bg-emerald-300 px-2.5 py-1 text-emerald-950">Hadir</span><span className="rounded-full bg-slate-300 px-2.5 py-1 text-slate-800">Tidak hadir</span><span className="rounded-full bg-rose-300 px-2.5 py-1 text-rose-950">MC / AL / UPL</span></div></div>
      <div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="pb-1 text-xs font-black uppercase tracking-wide text-slate-400 sm:text-sm">{day}</div>)}</div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">{calendarDays.map((date, index) => <div key={date || `empty-${index}`} className={`min-h-[8.5rem] overflow-hidden rounded-xl border p-1.5 sm:min-h-[11rem] sm:rounded-2xl sm:p-2.5 ${date ? 'border-white/5 bg-[#101319]' : 'border-transparent bg-transparent'}`}>{date && <><div className={`mb-2 ml-auto grid h-7 w-7 place-items-center rounded-full text-sm font-black sm:h-8 sm:w-8 sm:text-base ${date === todayLocal() ? 'bg-electric text-ink' : 'text-slate-200'}`}>{attendanceDateLabel(date, { day: 'numeric' })}</div><div className="grid gap-1">{activeStaff.map((person) => { const status = monthlyStaffStatus(person, date); if (!status) return null; const style = status === 'present' ? 'bg-emerald-300 text-emerald-950' : status === 'absent' ? 'bg-slate-300 text-slate-800' : 'bg-rose-300 text-rose-950'; return <div key={person.id} title={`${person.full_name} · ${status === 'present' ? 'Hadir' : status === 'absent' ? 'Tidak hadir' : 'MC / AL / UPL'}`} className={`truncate rounded-lg px-1.5 py-1 text-left text-[11px] font-bold leading-tight sm:px-2 sm:text-xs ${style}`}>{person.nickname || person.full_name}</div> })}</div></>}</div>)}</div>
      {!activeStaff.length && <div className="mt-4"><Empty title="No staff found" text="Try another name." /></div>}
    </Card>}

    {range !== 'monthly' && <Card><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold text-white">Record log</h3><p className="mt-1 text-xs text-slate-500">{scopedRecords.length} clock records in the selected day · edit or delete when needed.</p></div><History className="text-slate-500" size={19} /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Staff</th><th className="pb-3">Type</th><th className="pb-3">Time</th><th className="pb-3">Location</th><th className="pb-3">Status</th><th className="pb-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/5">{scopedRecords.map((item) => <tr key={item.id}><td className="py-4 font-bold text-white">{users.find((u) => u.id === item.staff_id)?.nickname || '—'}</td><td className="py-4"><Badge tone={item.type === 'in' ? 'green' : 'blue'}>{item.type === 'in' ? 'Clock In' : 'Clock Out'}</Badge></td><td className="py-4 text-slate-300">{formatDate(item.timestamp)}<div className="text-xs text-slate-500">{formatTime(item.timestamp)}</div></td><td className="py-4 text-slate-400">{item.distance_m}m from workshop</td><td className="py-4">{item.edited ? <Badge tone="amber">Edited by admin</Badge> : <Badge>Original</Badge>}</td><td className="py-4 text-right"><button className="mr-2 text-xs font-bold text-electric hover:text-white" onClick={() => openEditor(item)}>Edit</button><button className="text-xs font-bold text-red-200 hover:text-red-100" onClick={() => onDelete(item)}>Delete</button></td></tr>)}</tbody></table>{!scopedRecords.length && <div className="py-8 text-center text-sm text-slate-500">No clock records in this selection.</div>}</div></Card>}

    {editor && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto"><div className="flex items-start justify-between"><div><Badge tone="amber">Admin override</Badge><h2 className="mt-3 text-xl font-black text-white">{editor.id ? 'Edit record' : 'Add record'}</h2><p className="mt-1 text-sm text-slate-500">A reason is required for every change.</p></div><button onClick={() => setEditor(null)} className="rounded-xl p-2 text-slate-500 hover:bg-white/5"><X size={18} /></button></div><form onSubmit={submit} className="mt-5 grid gap-4"><Field label="Staff"><Select value={editor.staff_id} onChange={(e) => setEditor({ ...editor, staff_id: e.target.value })}>{staff.map((person) => <option key={person.id} value={person.id}>{person.nickname} · {person.full_name}</option>)}</Select></Field><Field label="Type"><Select value={editor.type} onChange={(e) => setEditor({ ...editor, type: e.target.value })}><option value="in">Clock In</option><option value="out">Clock Out</option></Select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Date"><Input type="date" value={editor.date} onChange={(e) => setEditor({ ...editor, date: e.target.value })} /></Field><Field label="Time"><Input type="time" value={editor.time} onChange={(e) => setEditor({ ...editor, time: e.target.value })} /></Field></div><Field label="Change reason"><textarea required rows="3" value={editor.reason} onChange={(e) => setEditor({ ...editor, reason: e.target.value })} className="w-full resize-none rounded-2xl border border-white/10 bg-ink/60 p-3.5 text-sm text-white outline-none focus:border-electric/70" placeholder="Example: Staff forgot to clock out." /></Field><div className="flex gap-2"><Button type="button" variant="secondary" className="flex-1" onClick={() => setEditor(null)}>Cancel</Button><Button type="submit" className="flex-1"><Check size={16} /> Save & audit</Button></div></form></Card></div>}
  </div>
}

function AdminLeaveForm({ users, leaves, balances, onClose, onAdd }) {
  const staff = users.filter((item) => item.role === 'staff' && item.is_active !== false)
  const [form, setForm] = useState({ staff_id: staff[0]?.id || '', type: 'MC', start_date: todayLocal(), end_date: todayLocal(), reason: '', status: 'Approved', remark: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const balance = getBalance(leaves, form.staff_id, form.type, balances)
  const days = dateDays(form.start_date, form.end_date)
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const updateType = (event) => setForm((prev) => ({ ...prev, type: event.target.value, status: event.target.value === 'UPL' ? 'Approved' : prev.status }))
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true)
    const result = await onAdd(form)
    if (result?.error) setError(result.error)
    else onClose()
    setBusy(false)
  }
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4"><Card className="my-6 w-full max-w-2xl"><div className="flex items-start justify-between"><div><Badge tone="blue">Admin entry</Badge><h2 className="mt-3 text-xl font-black text-white">Add leave for staff</h2><p className="mt-1 text-sm text-slate-500">Record MC, AL, or UPL directly for an active staff member.</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-white/5"><X size={18} /></button></div><form onSubmit={submit} className="mt-5 grid gap-4"><Field label="Staff"><Select required value={form.staff_id} onChange={update('staff_id')}><option value="">Select staff</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.nickname} · {person.full_name}</option>)}</Select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Leave type"><Select value={form.type} onChange={updateType}>{ALL_LEAVE_TYPES.map((type) => <option key={type} value={type}>{leaveTypeLabel(type)}</option>)}</Select></Field>{form.type !== 'UPL' ? <Field label="Status"><Select value={form.status} onChange={update('status')}><option>Approved</option><option>Pending</option><option>Rejected</option></Select></Field> : <div className="rounded-2xl border border-ember/20 bg-ember/10 p-3 text-sm text-ember">UPL is always recorded as Approved and does not deduct MC or AL.</div>}</div><div className="grid gap-4 sm:grid-cols-2"><Field label="Start date"><Input type="date" value={form.start_date} onChange={update('start_date')} required /></Field><Field label="End date"><Input type="date" value={form.end_date} onChange={update('end_date')} required /></Field></div><div className="rounded-2xl border border-white/10 bg-white/[.03] p-3 text-sm text-slate-300">{days > 0 ? `${days} day${days === 1 ? '' : 's'} · ` : ''}{form.type === 'UPL' ? 'Unpaid leave record · no balance deduction' : <>Remaining {form.type}: <b className={days > balance.remaining && form.status !== 'Rejected' ? 'text-red-200' : 'text-lime'}>{balance.remaining} days</b></>}</div><Field label="Reason"><textarea required rows="3" value={form.reason} onChange={update('reason')} className="w-full resize-none rounded-2xl border border-white/10 bg-ink/60 p-3.5 text-sm text-white outline-none focus:border-electric/70" placeholder={form.type === 'UPL' ? 'Example: Did not attend work without informing.' : 'Example: Medical leave'} /></Field><Field label="Admin remark" hint="Optional"><textarea rows="2" value={form.remark} onChange={update('remark')} className="w-full resize-none rounded-2xl border border-white/10 bg-ink/60 p-3.5 text-sm text-white outline-none focus:border-electric/70" placeholder="Optional note for staff" /></Field>{error && <div className="rounded-2xl bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}<div className="flex gap-2"><Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" disabled={busy || !staff.length}>{busy ? 'Saving…' : 'Save leave record'}</Button></div></form></Card></div>
}

function AdminLeaveSummary({ users, leaves, balances }) {
  const staff = users.filter((item) => item.role === 'staff')
  return <Card><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">Staff leave summary</h2><p className="mt-1 text-sm text-slate-500">Current MC and AL balance for every staff member.</p></div><Palmtree className="text-electric" size={22} /></div><div className="mt-5 overflow-x-auto"><table className="w-max whitespace-nowrap text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3 pr-8">Staff</th><th className="pb-3">MC baki</th><th className="pb-3">AL baki</th><th className="pb-3">UPL records</th></tr></thead><tbody className="divide-y divide-white/5">{staff.map((person) => { const mc = getBalance(leaves, person.id, 'MC', balances); const al = getBalance(leaves, person.id, 'AL', balances); const uplCount = leaves.filter((item) => item.staff_id === person.id && item.type === 'UPL').length; return <tr key={person.id}><td className="py-4 pr-8"><div className="font-bold text-white">{person.nickname}</div></td><td className="py-4"><b className="text-white">{mc.remaining} hari</b><div className="text-xs text-slate-500">Used {mc.used} / {mc.limit}</div></td><td className="py-4"><b className="text-white">{al.remaining} hari</b><div className="text-xs text-slate-500">Used {al.used} / {al.limit}</div></td><td className="py-4 text-slate-300">{uplCount} record{uplCount === 1 ? '' : 's'}</td></tr> })}</tbody></table>{!staff.length && <div className="py-8 text-center text-sm text-slate-500">No staff yet.</div>}</div></Card>
}

function AdminUplHistory({ users, leaves }) {
  const records = leaves.filter((item) => item.type === 'UPL').sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))
  return <Card><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">UPL records</h2><p className="mt-1 text-sm text-slate-500">Unpaid leave set by admin, shown with the reason and dates.</p></div><Badge tone="amber">{records.length} record{records.length === 1 ? '' : 's'}</Badge></div><div className="mt-5 grid gap-2">{records.map((item) => { const person = users.find((user) => user.id === item.staff_id); return <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white/[.03] p-3"><div><div className="font-semibold text-white">{person?.nickname || 'Unknown staff'}</div><div className="mt-1 text-sm text-slate-300">{formatDate(item.start_date)} — {formatDate(item.end_date)} · {dateDays(item.start_date, item.end_date)} days</div><div className="mt-1 text-sm text-slate-500">{item.reason}</div>{item.remark && <div className="mt-2 text-xs text-slate-400">Admin remark: {item.remark}</div>}</div><Badge tone="amber">UPL</Badge></div> })}{!records.length && <Empty title="No UPL records" text="Admin-created unpaid leave will appear here." />}</div></Card>
}

function ApprovedLeaveCalendar({ users, leaves }) {
  const [calendarMonth, setCalendarMonth] = useState(todayLocal().slice(0, 7))
  const [year, month] = calendarMonth.split('-').map(Number)
  const monthStart = `${calendarMonth}-01`
  const monthEnd = `${calendarMonth}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`
  const monthDays = Number(monthEnd.slice(-2))
  const calendarOffset = (attendanceDayOfWeek(monthStart) + 6) % 7
  const calendarDays = Array.from({ length: calendarOffset + monthDays }, (_, index) => index < calendarOffset ? null : shiftAttendanceDate(monthStart, index - calendarOffset))
  const approvedLeaves = leaves.filter((item) => item.status === 'Approved')
  const monthLeaves = approvedLeaves.filter((item) => item.start_date <= monthEnd && item.end_date >= monthStart)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  function moveMonth(amount) {
    const next = new Date(Date.UTC(year, month - 1 + amount, 1))
    setCalendarMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  return <div className="mt-5">
    <div className="flex items-center justify-between gap-2">
      <button className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={19} /></button>
      <div className="text-center"><div className="text-lg font-black text-white">{attendanceDateLabel(monthStart, { month: 'long', year: 'numeric' })}</div><div className="mt-1 text-xs text-slate-500">{monthLeaves.length} approved leave record{monthLeaves.length === 1 ? '' : 's'} in this month</div></div>
      <button className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={19} /></button>
    </div>
    <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:gap-2 sm:text-xs">{weekDays.map((day) => <div key={day}>{day}</div>)}</div>
    <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">{calendarDays.map((date, index) => {
      const dayLeaves = date ? approvedLeaves.filter((item) => item.start_date <= date && item.end_date >= date) : []
      return <div key={date || `empty-${index}`} className={`min-h-[8.5rem] overflow-hidden rounded-xl border p-1.5 sm:min-h-[11rem] sm:rounded-2xl sm:p-2.5 ${date ? 'border-white/5 bg-[#101319]' : 'border-transparent bg-transparent'}`}>
        {date && <><div className={`mb-2 ml-auto grid h-7 w-7 place-items-center rounded-full text-sm font-black sm:h-8 sm:w-8 sm:text-base ${date === todayLocal() ? 'bg-electric text-ink' : 'text-slate-200'}`}>{attendanceDateLabel(date, { day: 'numeric' })}</div><div className="grid max-h-28 gap-1 overflow-y-auto pr-0.5 sm:max-h-36">{dayLeaves.map((item) => { const person = users.find((user) => user.id === item.staff_id); const name = person?.nickname || 'Unknown staff'; return <div key={`${item.id}-${date}`} title={`${name} · ${item.type}`} className="flex items-center gap-1 rounded-lg bg-electric/10 px-1.5 py-1 text-left text-[11px] font-bold leading-tight text-electric sm:px-2 sm:text-xs"><span className="min-w-0 flex-1 truncate">{name}</span><span className="shrink-0 rounded bg-electric/15 px-1 py-0.5 text-[10px]">{item.type}</span></div> })}</div></>}
      </div>
    })}</div>
    {!monthLeaves.length && <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-center text-sm text-slate-500">No approved MC, AL, or UPL records in this month.</div>}
  </div>
}

function LeaveAdminPage({ users, leaves, balances, onDecision, onAdd }) {
  const [remark, setRemark] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [view, setView] = useState('requests')
  const pending = leaves.filter((item) => item.status === 'Pending')
  return <div className="grid gap-5"><AdminLeaveSummary users={users} leaves={leaves} balances={balances} /><AdminUplHistory users={users} leaves={leaves} /><Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">{view === 'requests' ? 'Leave Requests' : 'Approved Leave Calendar'}</h2><p className="mt-1 text-sm text-slate-500">{view === 'requests' ? 'Review the balance before approving.' : 'All approved MC, AL, and UPL records by date.'}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><div className="flex rounded-xl border border-white/10 bg-white/[.03] p-1"><button className={`rounded-lg px-3 py-2 text-xs font-bold transition ${view === 'requests' ? 'bg-electric text-ink' : 'text-slate-400 hover:text-white'}`} onClick={() => setView('requests')}>Requests</button><button className={`rounded-lg px-3 py-2 text-xs font-bold transition ${view === 'calendar' ? 'bg-electric text-ink' : 'text-slate-400 hover:text-white'}`} onClick={() => setView('calendar')}>Calendar</button></div>{view === 'requests' && <><Badge tone="amber">{pending.length} pending</Badge><Button onClick={() => setShowForm(true)}><Plus size={16} /> Add leave for staff</Button></>}</div></div>{view === 'calendar' ? <ApprovedLeaveCalendar users={users} leaves={leaves} /> : <><div className="mt-5 grid gap-3">{pending.map((item) => { const person = users.find((u) => u.id === item.staff_id); const balance = getBalance(leaves, item.staff_id, item.type, balances); const days = dateDays(item.start_date, item.end_date); return <div key={item.id} className="rounded-2xl border border-white/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-electric/15 font-black text-electric">{person?.nickname?.slice(0, 1)}</div><div><div className="font-bold text-white">{person?.nickname} <span className="ml-2 align-middle"><Badge tone="blue">{leaveTypeLabel(item.type)}</Badge></span></div><div className="mt-1 text-sm text-slate-300">{formatDate(item.start_date)} — {formatDate(item.end_date)} · {days} days</div><div className="mt-1 text-sm text-slate-500">{item.reason}</div>{item.attachment_name && <div className="mt-2 text-xs text-electric">Attachment: {item.attachment_name}</div>}</div></div><div className="text-right text-xs text-slate-500">Balance before: <b className="text-white">{balance.remaining} days</b></div></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><Input placeholder="Remark (optional)" value={remark[item.id] || ''} onChange={(e) => setRemark({ ...remark, [item.id]: e.target.value })} /><Button variant="danger" onClick={() => onDecision(item.id, 'Rejected', remark[item.id] || '')}><X size={15} /> Reject</Button><Button variant="lime" disabled={days > balance.remaining} onClick={() => onDecision(item.id, 'Approved', remark[item.id] || '')}><Check size={15} /> Approve</Button></div>{days > balance.remaining && <div className="mt-3 text-xs text-red-200">Application exceeds the remaining {item.type}. Approval is locked.</div>}</div> })}{!pending.length && <Empty title="No pending applications" text="All applications have been reviewed." />}</div><Card><h3 className="font-bold text-white">Decision history</h3><div className="mt-4 grid gap-2">{leaves.filter((item) => item.status !== 'Pending' && item.type !== 'UPL').map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] p-3"><div className="flex-1"><div className="text-sm font-semibold text-white">{users.find((u) => u.id === item.staff_id)?.nickname} · {leaveTypeLabel(item.type)}</div><div className="text-xs text-slate-500">{formatDate(item.start_date)} — {formatDate(item.end_date)}</div></div><Badge tone={item.status === 'Approved' ? 'green' : 'red'}>{item.status === 'Approved' ? 'Approved' : 'Rejected'}</Badge></div>)}{!leaves.some((item) => item.status !== 'Pending' && item.type !== 'UPL') && <div className="text-sm text-slate-500">No decision history yet.</div>}</div></Card></>}</Card>{showForm && <AdminLeaveForm users={users} leaves={leaves} balances={balances} onClose={() => setShowForm(false)} onAdd={onAdd} />}</div>
}

function AccountPage({ user, onChangePassword }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('')
    if (form.new_password.length < 6) return setError('New password must be at least 6 characters.')
    if (form.new_password !== form.confirm_password) return setError('New passwords do not match.')
    setBusy(true)
    const result = await onChangePassword(form)
    if (result?.error) setError(result.error)
    else { setMessage('Password changed successfully.'); setForm({ current_password: '', new_password: '', confirm_password: '' }) }
    setBusy(false)
  }
  return <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><Card><Badge tone="blue">Account</Badge><h2 className="mt-3 text-xl font-black text-white">Change password</h2><p className="mt-1 text-sm text-slate-500">Update the password for {user.email}.</p><form onSubmit={submit} className="mt-5 grid gap-4"><Field label="Current password"><Input required type="password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} /></Field><Field label="New password"><Input required type="password" minLength={6} value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} placeholder="Minimum 6 characters" /></Field><Field label="Confirm new password"><Input required type="password" minLength={6} value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} /></Field>{error && <div className="rounded-2xl bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}{message && <div className="rounded-2xl bg-lime/10 p-3 text-sm text-lime">{message}</div>}<Button type="submit" disabled={busy}><KeyRound size={16} /> {busy ? 'Changing…' : 'Change password'}</Button></form></Card><Card><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-electric/15 text-electric"><ShieldCheck size={19} /></div><div><h3 className="font-bold text-white">Account security</h3><p className="mt-1 text-sm leading-relaxed text-slate-400">Use a strong password that is different from passwords used on other services.</p><p className="mt-4 text-sm leading-relaxed text-slate-400">If you are staff, an admin can also reset your password from the Staff page.</p></div></div></Card></div>
}

function GoogleCalendarCard() {
  const [status, setStatus] = useState({ loading: true, connected: false })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function loadStatus() {
    if (!isSupabaseConfigured) { setStatus({ loading: false, connected: false }); return }
    const result = await googleCalendarAction('status')
    if (result.error || result.data?.error) setMessage(result.error?.message || result.data?.error || 'Calendar status unavailable.')
    else setStatus({ loading: false, ...result.data })
  }

  useEffect(() => { void loadStatus() }, [])

  async function connect() {
    setBusy(true); setMessage('')
    const result = await googleCalendarAction('get_connect_url')
    if (result.error || result.data?.error) {
      setMessage(result.error?.message || result.data?.error || 'Google Calendar connection failed.')
      setBusy(false)
      return
    }
    window.location.href = result.data.url
  }

  return <Card><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-lime/15 text-lime"><CalendarRange size={19} /></div><div className="min-w-0 flex-1"><Badge tone={status.connected ? 'green' : 'neutral'}>{status.loading ? 'Checking' : status.connected ? 'Connected' : 'Not connected'}</Badge><h3 className="mt-3 font-bold text-white">Google Calendar</h3><p className="mt-1 text-sm leading-relaxed text-slate-400">Appointments created here will be written to the connected Google Calendar for the AI agent to read.</p>{status.connected && <p className="mt-3 text-xs text-slate-500">{status.email || 'Google account'} · calendar: {status.calendar_id || 'primary'}</p>}{message && <div className="mt-4 rounded-2xl bg-red-400/10 p-3 text-sm text-red-100">{message}</div>}<Button className="mt-5" onClick={connect} disabled={busy || status.loading}>{busy ? 'Opening Google…' : status.connected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}</Button></div></div></Card>
}

function SettingsPage({ settings, onSave, rejectedLeaveCount, onDeleteRejectedLeaves }) {
  const [form, setForm] = useState(settings)
  return <div className="grid gap-5 lg:grid-cols-2"><Card><Badge tone="blue">Workshop</Badge><h2 className="mt-3 text-xl font-black text-white">Location settings</h2><p className="mt-1 text-sm text-slate-500">Staff can only clock in/out within the configured radius.</p><form className="mt-5 grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, workshop_lat: Number(form.workshop_lat), workshop_lng: Number(form.workshop_lng), radius_m: Number(form.radius_m) }) }}><Field label="Latitude"><Input type="number" step="any" value={form.workshop_lat} onChange={(e) => setForm({ ...form, workshop_lat: e.target.value })} /></Field><Field label="Longitude"><Input type="number" step="any" value={form.workshop_lng} onChange={(e) => setForm({ ...form, workshop_lng: e.target.value })} /></Field><Field label="Allowed radius (metres)"><Input type="number" min="10" value={form.radius_m} onChange={(e) => setForm({ ...form, radius_m: e.target.value })} /></Field><Button type="submit"><Check size={16} /> Save settings</Button></form></Card><Card><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-electric/15 text-electric"><MapPin size={19} /></div><div><h3 className="font-bold text-white">How to get coordinates</h3><p className="mt-1 text-sm leading-relaxed text-slate-400">Open Google Maps at the workshop, long-press the workshop point, and copy the latitude/longitude. Set the radius based on the parking area.</p></div></div><div className="mt-5 rounded-2xl bg-white/[.04] p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Active coordinates</div><div className="mt-2 font-mono text-sm text-electric">{Number(form.workshop_lat).toFixed(5)}, {Number(form.workshop_lng).toFixed(5)}</div><div className="mt-1 text-xs text-slate-500">Radius {form.radius_m} meter · Malaysia time</div></div><div className="mt-5 rounded-2xl border border-ember/20 bg-ember/10 p-4 text-sm text-ember">Test clock in after saving so staff are not blocked by outdated coordinates.</div></Card><Card className="border-red-300/20 bg-red-400/[.04]"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-400/15 text-red-200"><Trash2 size={19} /></div><div className="min-w-0"><Badge tone="red">Admin only</Badge><h3 className="mt-3 font-bold text-white">Rejected leave cleanup</h3><p className="mt-1 text-sm leading-relaxed text-slate-400">Delete all leave records that were rejected. This action cannot be undone.</p><Button type="button" variant="danger" className="mt-5" disabled={!rejectedLeaveCount} onClick={onDeleteRejectedLeaves}><Trash2 size={16} /> {rejectedLeaveCount ? `Delete ${rejectedLeaveCount} rejected record${rejectedLeaveCount === 1 ? '' : 's'}` : 'No rejected records'}</Button></div></div></Card><GoogleCalendarCard /></div>
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Zordaq UI error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="grid min-h-screen place-items-center bg-ink px-4 text-white"><div className="w-full max-w-lg rounded-[1.5rem] border border-red-300/20 bg-panel p-6 shadow-2xl"><Badge tone="red">Display error</Badge><h1 className="mt-4 text-2xl font-black">The dashboard could not be displayed.</h1><p className="mt-3 text-sm leading-relaxed text-slate-300">Reload the page. If the issue persists, send the error message below to the developer.</p><pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-red-100">{this.state.error?.message || String(this.state.error)}</pre><button className="mt-4 rounded-2xl bg-electric px-4 py-3 text-sm font-bold text-ink" onClick={() => window.location.reload()}>Reload</button></div></main>
  }
}

function App() {
  const [user, setUser] = useState(null)
  const [inviteMode, setInviteMode] = useState(() => typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('type') === 'invite' || window.location.hash.includes('type=invite')))
  const [active, setActive] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [attendance, setAttendance] = useState(() => readLocalData('attendance', seedAttendance()))
  const [leaves, setLeaves] = useState(() => readLocalData('leaves', seedLeaves()).map(normalizeLeaveType))
  const [users, setUsers] = useState(() => sortProfiles(readLocalData('users', demoUsers)))
  const [balances, setBalances] = useState(() => readLocalData('balances', seedBalances()).map(normalizeLeaveType))
  const [settings, setSettings] = useState(() => readLocalData('settings', defaultSettings))
  const [jobCards, setJobCards] = useState(() => readLocalData('jobCards', []))
  const [vehicles, setVehicles] = useState(() => readLocalData('vehicles', []))
  const [appointments, setAppointments] = useState(() => readLocalData('appointments', isSupabaseConfigured ? [] : seedAppointments()))
  const [notice, setNotice] = useState({})

  useEffect(() => {
    if (!notice.message) return undefined
    const timer = window.setTimeout(() => {
      setNotice((current) => current.message === notice.message ? {} : current)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('google_calendar')
    if (!result) return
    setNotice(result === 'connected'
      ? { type: 'success', message: 'Google Calendar connected.' }
      : { type: 'error', message: 'Google Calendar connection failed.' })
    window.history.replaceState({}, document.title, window.location.pathname)
  }, [])

  useEffect(() => {
    if (isSupabaseConfigured) return
    const saved = readDemo('session', null)
    if (saved && !inviteMode) setUser(saved)
  }, [inviteMode])
  useEffect(() => { if (user?.role === 'admin' && !active) setActive('overview'); else if (user && !active) setActive('dashboard') }, [user, active])
  useEffect(() => { writeDemo('attendance', attendance) }, [attendance])
  useEffect(() => { writeDemo('leaves', leaves) }, [leaves])
  useEffect(() => { writeDemo('users', users) }, [users])
  useEffect(() => { writeDemo('balances', balances) }, [balances])
  useEffect(() => { writeDemo('settings', settings) }, [settings])
  useEffect(() => { writeDemo('jobCards', jobCards) }, [jobCards])
  useEffect(() => { writeDemo('vehicles', vehicles) }, [vehicles])
  useEffect(() => { writeDemo('appointments', appointments) }, [appointments])
  useEffect(() => { if (!isSupabaseConfigured) writeDemo('localSnapshotVersion', LOCAL_SNAPSHOT_VERSION) }, [])
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}) }, [])
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let cancelled = false
    async function hydrateSession(session) {
      if (inviteMode) return
      if (!session?.user) {
        if (!cancelled) {
          localStorage.removeItem('zordaq:session')
          setUser(null)
          setActive(null)
        }
        return
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!cancelled && profile?.is_active) { setUser(profile); writeDemo('session', profile) }
    }
    supabase.auth.getSession().then(({ data }) => hydrateSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { void hydrateSession(session) })
    return () => { cancelled = true; listener.subscription.unsubscribe() }
  }, [inviteMode])
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return
    let cancelled = false
    ;(async () => {
      const [profileResult, attendanceResult, leaveResult, settingsResult, balancesResult, appointmentsResult] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('attendance').select('*').order('timestamp', { ascending: false }),
        supabase.from('leave_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*').eq('id', 1).single(),
        supabase.from('leave_balances').select('*').eq('year', yearLocal()),
        supabase.from('appointments').select('*').order('appointment_date', { ascending: true }).order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      if (profileResult.data) setUsers(sortProfiles(profileResult.data))
      if (attendanceResult.data) setAttendance(attendanceResult.data.map((item) => ({ ...item, edited: item.edited_by_admin })))
      if (leaveResult.data) setLeaves(leaveResult.data.map((item) => ({ ...item, attachment_name: item.attachment_path, remark: item.admin_remark })))
      if (settingsResult.data) setSettings(settingsResult.data)
      if (balancesResult.data) setBalances(balancesResult.data)
      if (appointmentsResult.data) setAppointments(appointmentsResult.data)
    })()
    return () => { cancelled = true }
  }, [user])

  async function refreshJobCards() {
    if (!isSupabaseConfigured) return
    try {
      const [jobsResult, vehiclesResult, itemsResult, partsResult, historyResult, photosResult, auditResult] = await Promise.all([
        supabase.from('job_cards').select('*').order('check_in_date', { ascending: false }),
        supabase.from('vehicles').select('*').order('plate_no'),
        supabase.from('job_items').select('*'),
        supabase.from('job_parts').select('*'),
        supabase.from('job_status_history').select('*').order('changed_at', { ascending: false }),
        supabase.from('job_photos').select('*').order('uploaded_at', { ascending: false }),
        supabase.from('job_card_audit_log').select('*').order('edited_at', { ascending: false }),
      ])
      if (jobsResult.error) { setNotice({ type: 'error', message: jobsResult.error.message }); return }
      const itemsByJob = (itemsResult.data || []).reduce((all, item) => ({ ...all, [item.job_id]: [...(all[item.job_id] || []), item] }), {})
      const partsByJob = (partsResult.data || []).reduce((all, item) => ({ ...all, [item.job_id]: [...(all[item.job_id] || []), item] }), {})
      const historyByJob = (historyResult.data || []).reduce((all, item) => ({ ...all, [item.job_id]: [...(all[item.job_id] || []), item] }), {})
      const photosByJob = (photosResult.data || []).reduce((all, item) => ({ ...all, [item.job_id]: [...(all[item.job_id] || []), item] }), {})
      const auditByJob = (auditResult.data || []).reduce((all, item) => ({ ...all, [item.job_id]: [...(all[item.job_id] || []), item] }), {})
      const signedPhotos = await Promise.all((photosResult.data || []).map(async (photo) => {
        const result = await supabase.storage.from('job-photos').createSignedUrl(photo.file_path, 3600)
        return [photo.id, result.data?.signedUrl || '']
      }))
      const signedById = Object.fromEntries(signedPhotos)
      const vehicleRows = (vehiclesResult.data || []).map((vehicle) => ({ ...vehicle, visit_count: (jobsResult.data || []).filter((job) => normalizePlateNo(job.plate_no) === normalizePlateNo(vehicle.plate_no)).length }))
      setVehicles(vehicleRows)
      setJobCards((jobsResult.data || []).map((job) => ({
        ...job,
        vehicles: vehicleRows.find((vehicle) => vehicle.plate_no === job.plate_no),
        job_items: itemsByJob[job.id] || [],
        job_parts: partsByJob[job.id] || [],
        job_status_history: historyByJob[job.id] || [],
        job_card_audit_log: auditByJob[job.id] || [],
        job_photos: (photosByJob[job.id] || []).map((photo) => ({ ...photo, signed_url: signedById[photo.id] })),
      })))
    } catch (error) {
      console.error('Job card data error', error)
      setNotice({ type: 'error', message: error.message || 'Job card data could not be loaded.' })
    }
  }

  useEffect(() => { if (user) refreshJobCards() }, [user])

  function login(nextUser) {
    const merged = users.find((item) => item.id === nextUser.id) || nextUser
    setInviteMode(false)
    setUser(merged)
    if (!isSupabaseConfigured) writeDemo('session', merged)
    setActive(merged.role === 'admin' ? 'overview' : 'dashboard')
  }
  async function signOut() { if (isSupabaseConfigured) await supabase.auth.signOut(); localStorage.removeItem('zordaq:session'); setInviteMode(false); setUser(null); setActive(null) }
  async function changeOwnPassword(form) {
    if (!form.current_password) return { error: 'Enter your current password.' }
    if (form.new_password.length < 6) return { error: 'New password must be at least 6 characters.' }
    if (form.new_password !== form.confirm_password) return { error: 'New passwords do not match.' }
    if (isSupabaseConfigured) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: form.current_password })
      if (verifyError) return { error: 'Current password is incorrect.' }
      const { error } = await supabase.auth.updateUser({ password: form.new_password })
      if (error) return { error: error.message || 'Password could not be changed.' }
    } else {
      const passwordOverrides = readDemo('passwordOverrides', {})
      const expected = passwordOverrides[user.id] || demoPassword
      if (form.current_password !== expected) return { error: 'Current password is incorrect.' }
      writeDemo('passwordOverrides', { ...passwordOverrides, [user.id]: form.new_password })
    }
    return {}
  }
  async function inviteStaff(email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email format.' }
    if (isSupabaseConfigured) {
      const { error } = await supabase.functions.invoke('invite-staff', { body: { email } })
      if (error) return { error: error.message || 'Invitation link could not be sent.' }
      return { message: `Invitation link sent to ${email}.` }
    }
    const invitations = readDemo('invitations', [])
    writeDemo('invitations', [{ id: `invite-${Date.now()}`, email, created_at: nowIso(), status: 'demo' }, ...invitations])
    return { message: `Demo mode: invitation for ${email} has been recorded. Real email sending is enabled after the Edge Function is deployed.` }
  }
  async function clock(type) {
    setNotice({ busy: true })
    try {
      if (type === 'in' && hasApprovedLeaveOnDate(leaves, user.id, todayLocal())) throw new Error('You have approved leave today and cannot clock in.')
      const last = attendance.filter((item) => item.staff_id === user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
      if (type === 'in' && last?.type === 'in') throw new Error('You are already clocked in. Please clock out first.')
      if (type === 'out' && last?.type !== 'in') throw new Error('You have not clocked in.')
      let position
      try { position = await getBrowserPosition() } catch (error) { if (isSupabaseConfigured) throw error; position = { coords: { latitude: settings.workshop_lat, longitude: settings.workshop_lng } } }
      const { latitude, longitude } = position.coords
      const distance = haversineDistance(latitude, longitude, settings.workshop_lat, settings.workshop_lng)
      if (distance > settings.radius_m) throw new Error(`You are ${distance}m from the workshop. The allowed limit is ${settings.radius_m}m.`)
      const item = { id: `att-${Date.now()}`, staff_id: user.id, type, timestamp: nowIso(), lat: latitude, lng: longitude, distance_m: distance, edited: false }
      if (isSupabaseConfigured) { const { data, error } = await supabase.from('attendance').insert({ staff_id: item.staff_id, type: item.type, timestamp: item.timestamp, lat: item.lat, lng: item.lng, distance_m: item.distance_m }).select().single(); if (error) throw error; item.id = data.id }
      setAttendance((prev) => [...prev, item]); setNotice({ type: 'success', message: `Clock ${type === 'in' ? 'In' : 'Out'} successfully recorded at ${formatTime(item.timestamp)}.` })
    } catch (error) { setNotice({ type: 'error', message: error.message }) } finally { setNotice((prev) => ({ ...prev, busy: false })) }
  }
  async function submitLeave(form) {
    if (!STAFF_LEAVE_TYPES.includes(form.type)) return { error: 'Staff can only apply for MC or AL.' }
    if (form.end_date < form.start_date) return { error: 'End date must be on or after the start date.' }
    if (hasActiveLeaveOverlap(leaves, user.id, form.start_date, form.end_date)) return { error: 'You already have a pending or approved leave request covering one or more of these dates.' }
    const days = dateDays(form.start_date, form.end_date); const balance = getBalance(leaves, user.id, form.type, balances)
    if (days > balance.remaining) return { error: `Application exceeds the remaining ${form.type}. You have ${balance.remaining} days.` }
    let attachmentName = form.attachment?.name || ''
    if (isSupabaseConfigured && form.attachment) { const path = `${user.id}/${Date.now()}-${form.attachment.name}`; const { error } = await supabase.storage.from('leave-attachments').upload(path, form.attachment); if (error) return { error: error.message }; attachmentName = path }
    const item = { id: `leave-${Date.now()}`, staff_id: user.id, type: form.type, start_date: form.start_date, end_date: form.end_date, reason: form.reason, status: 'Pending', remark: '', attachment_name: attachmentName }
    if (isSupabaseConfigured) { const { data, error } = await supabase.from('leave_requests').insert({ staff_id: item.staff_id, type: item.type, start_date: item.start_date, end_date: item.end_date, reason: item.reason, status: item.status, attachment_path: attachmentName || null }).select().single(); if (error) return { error: error.message }; item.id = data.id }
    setLeaves((prev) => [item, ...prev]); setNotice({ type: 'success', message: 'Leave request submitted successfully.' }); return {}
  }
  async function addLeaveForStaff(form) {
    const target = users.find((item) => item.id === form.staff_id)
    if (!target || target.role !== 'staff' || target.is_active === false) return { error: 'Select an active staff member.' }
    if (!ALL_LEAVE_TYPES.includes(form.type)) return { error: 'Select a valid leave type.' }
    if (form.end_date < form.start_date) return { error: 'End date must be on or after the start date.' }
    if (form.status !== 'Rejected' && hasActiveLeaveOverlap(leaves, form.staff_id, form.start_date, form.end_date)) return { error: 'This staff member already has a pending or approved leave request covering one or more of these dates.' }
    if (!form.reason?.trim()) return { error: 'Reason is required.' }
    const days = dateDays(form.start_date, form.end_date)
    const balance = getBalance(leaves, form.staff_id, form.type, balances)
    const status = form.type === 'UPL' ? 'Approved' : form.status
    if (form.type !== 'UPL' && status !== 'Rejected' && days > balance.remaining) return { error: `This record exceeds the remaining ${form.type}. Staff has ${balance.remaining} days left.` }
    const item = { id: `leave-${Date.now()}`, staff_id: form.staff_id, type: form.type, start_date: form.start_date, end_date: form.end_date, reason: form.reason.trim(), status, remark: form.remark?.trim() || '', attachment_name: '' }
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('leave_requests').insert({ staff_id: item.staff_id, type: item.type, start_date: item.start_date, end_date: item.end_date, reason: item.reason, status: item.status, admin_remark: item.remark || null, decided_by: item.status === 'Pending' ? null : user.id, decided_at: item.status === 'Pending' ? null : nowIso() }).select().single()
      if (error) return { error: error.message }
      item.id = data.id
    }
    setLeaves((prev) => [item, ...prev]); setNotice({ type: 'success', message: `Leave record added for ${target.nickname}.` }); return {}
  }
  function cancelLeave(id) { if (!window.confirm('Cancel this application?')) return; setLeaves((prev) => prev.filter((item) => item.id !== id)) }
  async function decideLeave(id, status, remark) { if (isSupabaseConfigured) await supabase.from('leave_requests').update({ status, admin_remark: remark || null, decided_by: user.id, decided_at: nowIso() }).eq('id', id); setLeaves((prev) => prev.map((item) => item.id === id ? { ...item, status, remark } : item)) }
  async function deleteRejectedLeaves() {
    if (user.role !== 'admin') return
    const count = leaves.filter((item) => item.status === 'Rejected').length
    if (!count || !window.confirm(`Delete all ${count} rejected leave record${count === 1 ? '' : 's'}? This action cannot be undone.`)) return
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('leave_requests').delete().eq('status', 'Rejected')
      if (error) { setNotice({ type: 'error', message: error.message }); return }
    }
    setLeaves((prev) => prev.filter((item) => item.status !== 'Rejected'))
    setNotice({ type: 'success', message: `${count} rejected leave record${count === 1 ? '' : 's'} deleted.` })
  }
  async function saveAttendance(editor) {
    const old = attendance.find((item) => item.id === editor.id)
    const next = { id: editor.id || `att-${Date.now()}`, staff_id: editor.staff_id, type: editor.type, timestamp: editor.timestamp, lat: editor.lat || settings.workshop_lat, lng: editor.lng || settings.workshop_lng, distance_m: editor.distance_m || 0, edited: true, audit_reason: editor.reason, audited_at: nowIso(), audited_by: user.id }
    if (isSupabaseConfigured) {
      const payload = { staff_id: next.staff_id, type: next.type, timestamp: next.timestamp, lat: next.lat, lng: next.lng, distance_m: next.distance_m, edited_by_admin: true }
      const result = editor.id ? await supabase.from('attendance').update(payload).eq('id', editor.id).select().single() : await supabase.from('attendance').insert(payload).select().single()
      if (result.error) { setNotice({ type: 'error', message: result.error.message }); return }
      next.id = result.data.id
      await supabase.from('attendance_audit_log').insert({ attendance_id: next.id, edited_by: user.id, old_value: old || null, new_value: next, reason: editor.reason })
    }
    setAttendance((prev) => editor.id ? prev.map((item) => item.id === editor.id ? { ...next } : item) : [...prev, next])
  }
  async function deleteAttendance(item) { const reason = window.prompt('Reason required to delete this record:'); if (!reason?.trim()) return; if (isSupabaseConfigured) { const result = await supabase.from('attendance').delete().eq('id', item.id); if (result.error) { setNotice({ type: 'error', message: result.error.message }); return }; await supabase.from('attendance_audit_log').insert({ attendance_id: item.id, edited_by: user.id, old_value: item, new_value: null, reason }) }; setAttendance((prev) => prev.filter((record) => record.id !== item.id)) }
  async function toggleUser(id) { const target = users.find((item) => item.id === id); if (!target) return; const is_active = !target.is_active; if (isSupabaseConfigured) { const { error } = await supabase.from('profiles').update({ is_active }).eq('id', id); if (error) { setNotice({ type: 'error', message: error.message }); return } }; setUsers((prev) => prev.map((item) => item.id === id ? { ...item, is_active } : item)) }
  async function editUser(details) {
    const full_name = details?.full_name?.trim()
    const nickname = details?.nickname?.trim()
    const target = users.find((item) => item.id === details?.id)
    if (!full_name || !nickname) return { error: 'Full name and nickname are required.' }
    if (details?.password) {
      if (target?.role !== 'staff') return { error: 'Only staff passwords can be changed here.' }
      if (details.password.length < 6) return { error: 'New password must be at least 6 characters.' }
      if (details.password !== details.confirm_password) return { error: 'New passwords do not match.' }
      if (isSupabaseConfigured) {
        const { error } = await supabase.functions.invoke('admin-update-password', { body: { staff_id: details.id, password: details.password } })
        if (error) return { error: error.message || 'Staff password could not be changed.' }
      } else {
        const passwordOverrides = readDemo('passwordOverrides', {})
        writeDemo('passwordOverrides', { ...passwordOverrides, [details.id]: details.password })
      }
    }
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('profiles').update({ full_name, nickname }).eq('id', details.id).select().single()
      if (error) return { error: error.message }
      setUsers((prev) => prev.map((item) => item.id === details.id ? data : item))
    } else {
      setUsers((prev) => prev.map((item) => item.id === details.id ? { ...item, full_name, nickname } : item))
    }
    return {}
  }
  async function saveBalance(staffId, type, value) { const limit_days = Math.max(0, Number(value) || 0); const existing = balances.find((item) => item.staff_id === staffId && item.year === yearLocal() && item.type === type); if (isSupabaseConfigured) { const { data, error } = await supabase.from('leave_balances').upsert({ id: existing?.id, staff_id: staffId, year: yearLocal(), type, limit_days }).select().single(); if (error) { setNotice({ type: 'error', message: error.message }); return }; setBalances((prev) => [...prev.filter((item) => item.id !== existing?.id && !(item.staff_id === staffId && item.year === yearLocal() && item.type === type)), data]) } else { setBalances((prev) => [...prev.filter((item) => !(item.staff_id === staffId && item.year === yearLocal() && item.type === type)), { id: existing?.id || `bal-${Date.now()}`, staff_id: staffId, year: yearLocal(), type, limit_days }]) } }
  async function saveSettings(value) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('settings').update({ workshop_lat: value.workshop_lat, workshop_lng: value.workshop_lng, radius_m: value.radius_m }).eq('id', 1).select().single()
      if (error) { setNotice({ type: 'error', message: error.message }); return }
      setSettings(data)
    } else setSettings(value)
    setNotice({ type: 'success', message: 'Location settings saved.' })
  }

  async function saveAppointment(value) {
    const payload = {
      appointment_date: value.appointment_date,
      appointment_time: value.appointment_time || '09:00',
      duration_minutes: Number(value.duration_minutes) || 60,
      customer_name: value.customer_name,
      customer_phone: value.customer_phone || '',
      plate_no: value.plate_no,
      car_model: value.car_model || '',
      job_description: value.job_description,
      status: value.status,
      updated_by: user.id,
    }
    try {
      let syncError = ''
      if (isSupabaseConfigured) {
        const query = value.id
          ? supabase.from('appointments').update(payload).eq('id', value.id).select().single()
          : supabase.from('appointments').insert({ ...payload, created_by: user.id }).select().single()
        const result = await query
        if (result.error) throw result.error
        let saved = result.data
        const syncResult = await googleCalendarAction('upsert', { appointment_id: saved.id })
        if (syncResult.error || syncResult.data?.error) {
          syncError = syncResult.error?.message || syncResult.data?.error
        } else {
          const refreshed = await supabase.from('appointments').select('*').eq('id', saved.id).single()
          if (refreshed.data) saved = refreshed.data
        }
        setAppointments((prev) => value.id ? prev.map((item) => item.id === value.id ? saved : item) : [saved, ...prev])
      } else {
        const item = { ...value, ...payload, id: value.id || `appointment-${Date.now()}`, created_by: value.created_by || user.id, created_at: value.created_at || nowIso(), updated_at: nowIso() }
        setAppointments((prev) => value.id ? prev.map((row) => row.id === value.id ? item : row) : [item, ...prev])
      }
      setNotice(syncError
        ? { type: 'error', message: `Appointment saved, tetapi Google Calendar gagal: ${syncError}` }
        : { type: 'success', message: value.id ? 'Appointment updated.' : 'Appointment added.' })
      return {}
    } catch (error) { return { error: error.message || 'Appointment could not be saved.' } }
  }

  async function deleteAppointment(item) {
    if (user.role !== 'admin') return { error: 'Only admin can delete appointments.' }
    try {
      if (isSupabaseConfigured) {
        const syncResult = await googleCalendarAction('delete', { appointment_id: item.id })
        if (syncResult.error || syncResult.data?.error) throw new Error(syncResult.error?.message || syncResult.data?.error)
        const result = await supabase.from('appointments').delete().eq('id', item.id)
        if (result.error) throw result.error
      }
      setAppointments((prev) => prev.filter((row) => row.id !== item.id))
      setNotice({ type: 'success', message: 'Appointment deleted.' })
      return {}
    } catch (error) { return { error: error.message || 'Appointment could not be deleted.' } }
  }

  async function moveAppointmentToJobCard(appointment) {
    if (appointment.appointment_date !== todayLocal()) return { error: 'Only today\'s appointments can be moved to a Job Card.' }
    const form = {
      plate_no: appointment.plate_no,
      car_model: appointment.car_model || '',
      customer_complaint: appointment.job_description,
      check_in_date: appointment.appointment_date,
      status: 'Baru',
      notes: [`Customer: ${appointment.customer_name}`, appointment.customer_phone ? `Phone: ${appointment.customer_phone}` : ''].filter(Boolean).join('\n'),
      assigned_staff: user.id,
      job_items: [{ description: appointment.job_description, is_done: false }],
      job_parts: [],
    }
    try {
      if (isSupabaseConfigured) {
        const calendarResult = await googleCalendarAction('delete', { appointment_id: appointment.id })
        if (calendarResult.error || calendarResult.data?.error) throw new Error(calendarResult.error?.message || calendarResult.data?.error)
        const result = await supabase.rpc('move_appointment_to_job_card', { p_appointment_id: appointment.id, p_assigned_staff: user.id })
        if (result.error) {
          await googleCalendarAction('upsert', { appointment_id: appointment.id })
          throw result.error
        }
        await refreshJobCards()
      } else {
        const result = await saveJobCard(form)
        if (result?.error) return result
      }
      setAppointments((prev) => prev.filter((item) => item.id !== appointment.id))
      setNotice({ type: 'success', message: 'Appointment moved to Job Card and removed from today\'s appointments.' })
      return {}
    } catch (error) {
      return { error: error.message || 'Appointment could not be moved to a Job Card.' }
    }
  }

  async function saveJobCard(form) {
    const plate = normalizePlateNo(form.plate_no)
    if (!plate) { setNotice({ type: 'error', message: 'Enter a registration number.' }); return { error: 'plate' } }
    if (!form.customer_complaint?.trim()) { setNotice({ type: 'error', message: 'Enter the customer complaint.' }); return { error: 'complaint' } }
    const previousJob = form.id ? jobCards.find((item) => item.id === form.id) : null
    const becameReady = form.status === 'Siap' && previousJob?.status !== 'Siap'
    try {
      if (!isSupabaseConfigured) {
        const vehicle = vehicles.find((item) => normalizePlateNo(item.plate_no) === plate) || { plate_no: plate, car_model: form.car_model || '', visit_count: 0 }
        const id = form.id || `job-${Date.now()}`
        const current = jobCards.find((item) => item.id === id)
        const auditEntry = { id: `audit-${Date.now()}`, job_id: id, edited_by: user.id, edited_at: nowIso(), action: form.id ? 'job_cards_updated' : 'job_cards_created', changed_fields: { details: true, items: true, parts: true }, old_value: current || null, new_value: form }
        const item = { ...form, id, plate_no: plate, vehicles: { ...vehicle, car_model: form.car_model || vehicle.car_model }, job_items: (form.job_items || []).filter((row) => row.description?.trim()), job_parts: (form.job_parts || []).filter((row) => row.name?.trim()), job_status_history: current?.job_status_history || [{ id: `history-${Date.now()}`, old_status: null, new_status: form.status, changed_by: user.id, changed_at: nowIso() }], job_card_audit_log: [...(current?.job_card_audit_log || []), auditEntry], job_photos: current?.job_photos || [] }
        setJobCards((prev) => form.id ? prev.map((row) => row.id === form.id ? item : row) : [item, ...prev])
        setVehicles((prev) => prev.some((row) => normalizePlateNo(row.plate_no) === plate) ? prev.map((row) => normalizePlateNo(row.plate_no) === plate ? { ...row, car_model: form.car_model || row.car_model, visit_count: form.id ? row.visit_count : row.visit_count + 1 } : row) : [...prev, { ...vehicle, car_model: form.car_model || vehicle.car_model, visit_count: 1 }])
        setNotice({ type: 'success', message: form.id ? 'Job card updated.' : 'Job card created successfully.' })
        return {}
      }
      let vehicle = vehicles.find((item) => normalizePlateNo(item.plate_no) === plate)
      const vehicleResult = await supabase.from('vehicles').upsert({ plate_no: plate, car_model: form.car_model || '' }).select().single()
      if (vehicleResult.error) throw vehicleResult.error
      vehicle = vehicleResult.data
      const payload = { plate_no: plate, customer_complaint: form.customer_complaint.trim(), check_in_date: form.check_in_date, status: form.status, notes: form.notes || null, assigned_staff: form.assigned_staff || null }
      const jobResult = form.id
        ? await supabase.from('job_cards').update(payload).eq('id', form.id).select().single()
        : await supabase.from('job_cards').insert({ ...payload, created_by: user.id }).select().single()
      if (jobResult.error) throw jobResult.error
      const jobId = jobResult.data.id
      const clearItems = await supabase.from('job_items').delete().eq('job_id', jobId)
      if (clearItems.error) throw clearItems.error
      const itemRows = (form.job_items || []).filter((row) => row.description?.trim()).map((row) => ({ job_id: jobId, description: row.description.trim(), is_done: Boolean(row.is_done) }))
      if (itemRows.length) { const result = await supabase.from('job_items').insert(itemRows); if (result.error) throw result.error }
      const clearParts = await supabase.from('job_parts').delete().eq('job_id', jobId)
      if (clearParts.error) throw clearParts.error
      const partRows = (form.job_parts || []).filter((row) => row.name?.trim()).map((row) => ({ job_id: jobId, name: row.name.trim(), qty: Math.max(1, Number(row.qty) || 1) }))
      if (partRows.length) { const result = await supabase.from('job_parts').insert(partRows); if (result.error) throw result.error }
      let telegramError = ''
      if (becameReady) {
        const notificationResult = await supabase.functions.invoke('notify-telegram-ready', { body: { job_id: jobId } })
        if (notificationResult.error) telegramError = notificationResult.error.message || 'Telegram notification failed.'
      }
      await refreshJobCards()
      setNotice({
        type: telegramError ? 'error' : 'success',
        message: telegramError
          ? `Job card saved, but Telegram notification failed: ${telegramError}`
          : `${form.id ? 'Job card updated.' : 'Job card created successfully.'}${becameReady ? ' Telegram notification sent.' : ''}`,
      })
      return {}
    } catch (error) { setNotice({ type: 'error', message: error.message || 'Job card could not be saved.' }); return { error: error.message } }
  }

  async function uploadJobPhotos(jobId, files) {
    try {
      const uploaded = []
      for (const [index, file] of files.entries()) {
        if (!file.type.startsWith('image/')) continue
        const blob = await compressImage(file)
        const path = `${jobId}/${user.id}-${Date.now()}-${index}.jpg`
        if (isSupabaseConfigured) {
          const uploadResult = await supabase.storage.from('job-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
          if (uploadResult.error) throw uploadResult.error
          const photoResult = await supabase.from('job_photos').insert({ job_id: jobId, file_path: path, uploaded_by: user.id }).select().single()
          if (photoResult.error) throw photoResult.error
        } else {
          uploaded.push({ id: `photo-${Date.now()}-${index}`, job_id: jobId, file_path: path, uploaded_by: user.id, uploaded_at: nowIso(), signed_url: URL.createObjectURL(blob) })
        }
      }
      if (!isSupabaseConfigured) setJobCards((prev) => prev.map((job) => job.id === jobId ? { ...job, job_photos: [...(job.job_photos || []), ...uploaded] } : job))
      else await refreshJobCards()
      setNotice({ type: 'success', message: `${files.length} image(s) uploaded successfully.` })
    } catch (error) { setNotice({ type: 'error', message: error.message || 'Images could not be uploaded.' }) }
  }

  async function deleteJobPhoto(photo) {
    if (!window.confirm('Delete this image?')) return
    try {
      if (isSupabaseConfigured) { const result = await supabase.from('job_photos').delete().eq('id', photo.id); if (result.error) throw result.error; await supabase.storage.from('job-photos').remove([photo.file_path]); await refreshJobCards() }
      else setJobCards((prev) => prev.map((job) => ({ ...job, job_photos: (job.job_photos || []).filter((item) => item.id !== photo.id) })))
      setNotice({ type: 'success', message: 'Image deleted.' })
    } catch (error) { setNotice({ type: 'error', message: error.message || 'Image could not be deleted.' }) }
  }

  if (!user) return inviteMode && isSupabaseConfigured ? <InviteSetupScreen onComplete={login} /> : <AuthScreen onLogin={login} />
  const titles = { dashboard: 'Today', appointments: 'Appointments', leave: 'My Leave', overview: 'Operations overview', people: 'Staff', attendance: 'Attendance', 'leave-admin': 'Leave Requests', settings: 'Workshop settings', account: 'Account', 'job-cards': 'Job Cards', 'vehicle-history': 'Vehicle History' }
  let page
  if (active === 'dashboard') page = <StaffDashboard user={user} attendance={attendance} settings={settings} leaves={leaves} balances={balances} appointments={appointments} jobCards={jobCards} onClock={clock} notice={notice} setActive={setActive} />
  if (active === 'appointments') page = <AppointmentsPage user={user} appointments={appointments} onSave={saveAppointment} onDelete={deleteAppointment} onMoveToJobCard={moveAppointmentToJobCard} />
  if (active === 'leave') page = <LeavePage user={user} leaves={leaves} balances={balances} onSubmit={submitLeave} onCancel={cancelLeave} />
  if (active === 'overview') page = <AdminOverview users={users} attendance={attendance} leaves={leaves} appointments={appointments} setActive={setActive} />
  if (active === 'people') page = <PeoplePage users={users} leaves={leaves} balances={balances} onToggle={toggleUser} onBalanceSave={saveBalance} onEdit={editUser} onInvite={inviteStaff} />
  if (active === 'attendance') page = <AttendancePage users={users} attendance={attendance} leaves={leaves} onSave={saveAttendance} onDelete={deleteAttendance} />
  if (active === 'leave-admin') page = <LeaveAdminPage users={users} leaves={leaves} balances={balances} onDecision={decideLeave} onAdd={addLeaveForStaff} />
  if (active === 'settings') page = <SettingsPage settings={settings} onSave={saveSettings} rejectedLeaveCount={leaves.filter((item) => item.status === 'Rejected').length} onDeleteRejectedLeaves={deleteRejectedLeaves} />
  if (active === 'account') page = <AccountPage user={user} onChangePassword={changeOwnPassword} />
  if (active === 'job-cards') page = <JobCardsPage user={user} users={users} jobs={jobCards} vehicles={vehicles} onSave={saveJobCard} onUpload={uploadJobPhotos} onDeletePhoto={deleteJobPhoto} />
  if (active === 'vehicle-history') page = <JobCardsPage user={user} users={users} jobs={jobCards} vehicles={vehicles} isHistoryPage onSave={saveJobCard} onUpload={uploadJobPhotos} onDeletePhoto={deleteJobPhoto} />
  return <div className="min-h-screen bg-ink text-white lg:flex"><Sidebar user={user} active={active} setActive={setActive} onSignOut={signOut} open={menuOpen} setOpen={setMenuOpen} /><div className="min-w-0 flex-1"><Header user={user} title={titles[active]} onMenu={() => setMenuOpen(true)} /><main className="mx-auto max-w-7xl p-4 pb-24 sm:p-8">{notice.message && active !== 'dashboard' && <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-300/20 bg-red-400/10 text-red-100' : 'border-lime/20 bg-lime/10 text-lime'}`}>{notice.message}</div>}{page}</main><div className="fixed bottom-4 right-4 hidden items-center gap-2 rounded-full border border-white/10 bg-panel/90 px-3 py-2 text-[11px] text-slate-400 shadow-xl sm:flex"><span className="h-2 w-2 rounded-full bg-lime" /> Asia/Kuala Lumpur</div></div></div>
}

export default function AppWithErrorBoundary() {
  return <AppErrorBoundary><App /></AppErrorBoundary>
}
