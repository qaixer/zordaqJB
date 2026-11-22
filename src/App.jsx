import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, ArrowRight, CalendarDays, Check, ChevronDown, ClipboardList, Clock3, Download, Gauge, History, LogOut,
  MapPin, Menu, Palmtree, PanelLeft, Plus, Settings, ShieldCheck, Smartphone, UserRound,
  Users, X, XCircle, Zap,
} from 'lucide-react'
import { demoPassword, demoUsers, isSupabaseConfigured, readDemo, supabase, writeDemo } from './lib/supabase'
import { formatDate, formatTime, hoursBetween, nowIso, todayLocal, yearLocal } from './lib/date'
import { getBrowserPosition, haversineDistance } from './lib/geo'
import { downloadCsv } from './lib/csv'
import JobCardsPage from './components/JobCardsPage'
import { compressImage, normalizePlateNo } from './lib/jobCards'

const defaultSettings = { workshop_lat: 1.4927, workshop_lng: 103.7414, radius_m: 100 }
const seedBalances = () => [
  { id: 'bal-mc-demo', staff_id: 'demo-staff', year: yearLocal(), type: 'MC', limit_days: 14 },
  { id: 'bal-el-demo', staff_id: 'demo-staff', year: yearLocal(), type: 'EL', limit_days: 14 },
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

function Card({ children, className = '' }) {
  return <section className={`rounded-[1.5rem] border border-white/10 bg-panel/80 p-4 shadow-glow backdrop-blur sm:p-5 ${className}`}>{children}</section>
}

function Badge({ children, tone = 'neutral' }) {
  const tones = { neutral: 'bg-white/10 text-slate-200', green: 'bg-lime/15 text-lime', amber: 'bg-ember/15 text-ember', red: 'bg-red-400/15 text-red-200', blue: 'bg-electric/15 text-electric' }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[tone]}`}>{children}</span>
}

function Logo({ compact = false }) {
  return <div className="flex items-center gap-3">
    <img src={compact ? '/logo-round.png' : '/logo-wide.png'} alt="Zordaq JB" className={compact ? 'h-11 w-11 rounded-full object-cover' : 'h-12 w-32 rounded-xl object-cover object-center'} />
    {!compact && <div className="hidden sm:block"><div className="text-sm font-black tracking-[.18em] text-white">MOTORSPORTS JB</div><div className="text-[10px] uppercase tracking-[.3em] text-electric">Sistem operasi bengkel</div></div>}
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
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', full_name: '', nickname: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (isSupabaseConfigured) {
        if (mode === 'login') {
          const { data, error: authError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
          if (authError) throw authError
          const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
          if (profileError) throw profileError
          if (!profile.is_active) { await supabase.auth.signOut(); throw new Error('Akaun ini telah dinyahaktifkan oleh admin.') }
          onLogin(profile)
        } else {
          const { data, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { full_name: form.full_name, nickname: form.nickname }, emailRedirectTo: window.location.origin } })
          if (authError) throw authError
          setError(data.session ? '' : 'Semak email anda untuk sahkan akaun.')
          if (data.session) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
            onLogin(profile || data.user)
          }
        }
      } else {
        if (mode === 'login') {
          const user = demoUsers.find((item) => item.email.toLowerCase() === form.email.toLowerCase() && item.is_active)
          if (!user || form.password !== demoPassword) throw new Error('Email atau kata laluan demo tidak tepat.')
          onLogin(user)
        } else {
          if (!form.email || !form.full_name || !form.nickname || form.password.length < 6) throw new Error('Lengkapkan semua medan. Kata laluan minimum 6 aksara.')
          const users = readDemo('users', demoUsers)
          const user = { id: `demo-${Date.now()}`, email: form.email, full_name: form.full_name, nickname: form.nickname, role: 'staff', is_active: true }
          writeDemo('users', [...users, user]); onLogin(user)
        }
      }
    } catch (err) { setError(err.message || 'Ada masalah. Cuba lagi.') } finally { setBusy(false) }
  }

  return <main className="grid min-h-screen place-items-center overflow-hidden bg-ink px-4 py-8 text-white">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(124,156,255,.2),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(185,239,112,.1),transparent_26%)]" />
    <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-panel/80 shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
      <div className="hidden min-h-[650px] flex-col justify-between bg-[url('/logo-wide.png')] bg-cover bg-center p-10 lg:flex">
        <div><Logo /><div className="mt-24 max-w-sm"><p className="mb-4 text-xs font-bold uppercase tracking-[.3em] text-lime">Ops bengkel yang lebih kemas</p><h1 className="text-5xl font-black leading-[.98]">Kerja laju.<br />Rekod jelas.</h1><p className="mt-5 text-slate-300">Kehadiran dan cuti staf Zordaq Motorsports JB, dalam satu tempat.</p></div></div>
        <div className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={15} className="text-lime" /> Akses ikut peranan · Masa Malaysia</div>
      </div>
      <div className="p-6 sm:p-10"><div className="mb-8 lg:hidden"><Logo compact /></div><div className="mb-8"><Badge tone="blue">ZORDAQ JB · {isSupabaseConfigured ? 'LIVE' : 'DEMO'}</Badge><h2 className="mt-4 text-3xl font-black">{mode === 'login' ? 'Selamat kembali.' : 'Daftar akaun.'}</h2><p className="mt-2 text-sm text-slate-400">{mode === 'login' ? 'Masuk untuk teruskan operasi hari ini.' : 'Akaun baharu akan bermula sebagai staff.'}</p></div>
        <form onSubmit={submit} className="grid gap-4">
          {mode === 'register' && <><Field label="Nama penuh"><Input required value={form.full_name} onChange={update('full_name')} placeholder="Contoh: Aiman Hakimi" /></Field><Field label="Nama panggilan"><Input required value={form.nickname} onChange={update('nickname')} placeholder="Contoh: Aiman" /></Field></>}
          <Field label="Email"><Input required type="email" value={form.email} onChange={update('email')} placeholder="nama@zordaq.my" /></Field>
          <Field label="Kata laluan"><Input required type="password" value={form.password} onChange={update('password')} placeholder="••••••••" minLength={6} /></Field>
          {error && <div className={`rounded-2xl border px-3 py-3 text-sm ${error.startsWith('Semak') ? 'border-lime/20 bg-lime/10 text-lime' : 'border-red-300/20 bg-red-400/10 text-red-100'}`}><AlertCircle className="mr-2 inline" size={15} />{error}</div>}
          <Button disabled={busy} className="mt-2 w-full">{busy ? 'Sila tunggu…' : mode === 'login' ? 'Masuk ke dashboard' : 'Daftar sebagai staff'} <ArrowRight size={17} /></Button>
        </form>
        {!isSupabaseConfigured && <div className="mt-5 rounded-2xl border border-electric/20 bg-electric/10 p-3 text-xs text-slate-300"><b className="text-electric">Mod demo:</b> admin `paan@zordaq.my` atau staff `staff@zordaq.my` · kata laluan `12345678`</div>}
        <button className="mt-7 w-full text-center text-sm text-slate-400 hover:text-white" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Belum ada akaun? Daftar staff' : 'Sudah ada akaun? Masuk'}</button>
      </div>
    </div>
  </main>
}

function Sidebar({ user, active, setActive, onSignOut, open, setOpen }) {
  const staffLinks = [{ id: 'dashboard', label: 'Hari ini', icon: Gauge }, { id: 'job-cards', label: 'Job Cards', icon: ClipboardList }, { id: 'vehicle-history', label: 'Sejarah Kereta', icon: History }, { id: 'leave', label: 'Cuti saya', icon: Palmtree }]
  const adminLinks = [{ id: 'overview', label: 'Ringkasan', icon: Gauge }, { id: 'job-cards', label: 'Job Cards', icon: ClipboardList }, { id: 'vehicle-history', label: 'Sejarah Kereta', icon: History }, { id: 'people', label: 'Kakitangan', icon: Users }, { id: 'attendance', label: 'Kehadiran', icon: Clock3 }, { id: 'leave-admin', label: 'Permohonan cuti', icon: Palmtree }, { id: 'settings', label: 'Tetapan', icon: Settings }]
  const links = user.role === 'admin' ? adminLinks : staffLinks
  return <><div className={`fixed inset-0 z-30 bg-black/50 transition lg:hidden ${open ? 'visible opacity-100' : 'invisible opacity-0'}`} onClick={() => setOpen(false)} /><aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-ink p-4 transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className="flex items-center justify-between px-2 py-2"><Logo compact /><button className="rounded-xl p-2 text-slate-500 lg:hidden" onClick={() => setOpen(false)}><X size={18} /></button></div>
    <div className="mt-10 px-2"><div className="mb-3 text-[10px] font-bold uppercase tracking-[.25em] text-slate-600">Menu utama</div><nav className="grid gap-1">{links.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setActive(id); setOpen(false) }} className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold transition ${active === id ? 'bg-electric text-ink' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon size={18} />{label}</button>)}</nav></div>
    <div className="mt-auto rounded-2xl border border-white/10 bg-panel p-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-electric/15 text-sm font-black text-electric">{user.nickname?.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-white">{user.nickname}</div><div className="text-xs capitalize text-slate-500">{user.role}</div></div></div><button className="mt-3 flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white" onClick={onSignOut}><LogOut size={16} /> Keluar</button></div>
  </aside></>
}

function Header({ user, title, onMenu }) {
  return <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-8"><div className="flex items-center gap-3"><button className="rounded-xl p-2 text-slate-400 hover:bg-white/5 lg:hidden" onClick={onMenu}><Menu size={20} /></button><div><div className="text-xs font-medium text-slate-500">{new Intl.DateTimeFormat('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())}</div><h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h1></div></div><div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 sm:flex"><span className="h-2 w-2 rounded-full bg-lime shadow-[0_0_10px_#b9ef70]" /> {user.nickname} · {user.role === 'admin' ? 'Owner' : 'Staff'}</div></header>
}

function ClockCard({ user, settings, attendance, onClock, notice }) {
  const own = attendance.filter((item) => item.staff_id === user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const clockedIn = own[0]?.type === 'in'
  const lastIn = own.find((item) => item.type === 'in')
  const lastOut = own.find((item) => item.type === 'out')
  return <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(124,156,255,.16),rgba(18,26,53,.8)_45%)]"><div className="flex items-start justify-between gap-3"><div><Badge tone={clockedIn ? 'green' : 'neutral'}>{clockedIn ? 'Sedang bekerja' : 'Belum clock in'}</Badge><h2 className="mt-3 text-2xl font-black text-white">{clockedIn ? 'Jangan lupa clock out.' : 'Selamat pagi, '}{!clockedIn && <span className="text-electric">{user.nickname}.</span>}</h2><p className="mt-2 text-sm text-slate-400">{clockedIn ? `Clock in ${formatTime(lastIn?.timestamp)} · radius ${lastIn?.distance_m ?? '—'}m` : 'Rekod masa kerja anda untuk hari ini.'}</p></div><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-electric/15 text-electric"><MapPin size={21} /></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Button variant={clockedIn ? 'secondary' : 'lime'} disabled={Boolean(clockedIn) || notice?.busy} onClick={() => onClock('in')} className="min-h-16 text-base"><MapPin size={20} /> Clock In</Button><Button variant={!clockedIn ? 'secondary' : 'primary'} disabled={!clockedIn || notice?.busy} onClick={() => onClock('out')} className="min-h-16 text-base"><Clock3 size={20} /> Clock Out</Button></div><div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span>Masuk terakhir <b className="text-slate-300">{formatTime(lastIn?.timestamp)}</b></span><span>Keluar terakhir <b className="text-slate-300">{formatTime(lastOut?.timestamp)}</b></span><span className="inline-flex items-center gap-1"><Smartphone size={13} /> GPS radius {settings.radius_m}m</span></div>{notice?.message && <div className={`mt-4 rounded-2xl border px-3 py-3 text-sm ${notice.type === 'error' ? 'border-red-300/20 bg-red-400/10 text-red-100' : 'border-lime/20 bg-lime/10 text-lime'}`}>{notice.message}</div>}</Card>
}

function StatCard({ label, value, hint, tone = 'blue', icon: Icon }) {
  return <Card className="relative overflow-hidden"><div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${tone === 'green' ? 'bg-lime/20' : tone === 'amber' ? 'bg-ember/20' : 'bg-electric/20'}`} /><div className="relative flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-3 text-3xl font-black text-white">{value}</div><div className="mt-1 text-xs text-slate-500">{hint}</div></div><Icon className="text-slate-500" size={18} /></div></Card>
}

function StaffDashboard({ user, attendance, settings, leaves, balances, onClock, notice, setActive }) {
  const own = attendance.filter((item) => item.staff_id === user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const monthHours = own.reduce((sum, item, index, rows) => item.type === 'out' && rows[index - 1]?.type === 'in' ? sum + hoursBetween(rows[index - 1].timestamp, item.timestamp) : sum, 0)
  const balance = getBalance(leaves, user.id, 'MC', balances)
  return <div className="grid gap-5"><div className="grid gap-4 md:grid-cols-3"><StatCard label="Hari hadir bulan ini" value="1" hint="Daripada rekod attendance" icon={CalendarDays} /><StatCard label="Jam direkod" value={`${monthHours.toFixed(1)}j`} hint="Bulan semasa" tone="green" icon={Clock3} /><StatCard label="Baki MC" value={`${balance.remaining} hari`} hint={`Daripada ${balance.limit} hari`} tone="amber" icon={Palmtree} /></div><ClockCard user={user} settings={settings} attendance={attendance} onClock={onClock} notice={notice} /><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><Card><div className="flex items-center justify-between"><div><h3 className="font-bold text-white">Aktiviti terkini</h3><p className="mt-1 text-xs text-slate-500">Rekod peribadi anda</p></div><button onClick={() => setActive('leave')} className="text-xs font-bold text-electric hover:text-white">Lihat cuti <ArrowRight className="ml-1 inline" size={13} /></button></div><div className="mt-5 grid gap-2">{own.slice(0, 4).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] p-3"><div className={`grid h-9 w-9 place-items-center rounded-xl ${item.type === 'in' ? 'bg-lime/10 text-lime' : 'bg-electric/10 text-electric'}`}>{item.type === 'in' ? <ArrowRight size={16} /> : <LogOut size={16} />}</div><div className="flex-1"><div className="text-sm font-semibold text-slate-200">Clock {item.type === 'in' ? 'In' : 'Out'}</div><div className="text-xs text-slate-500">{formatDate(item.timestamp)} · GPS {item.distance_m}m</div></div><div className="text-sm font-bold text-white">{formatTime(item.timestamp)}</div></div>)}{!own.length && <Empty title="Belum ada rekod" text="Clock in untuk mula rekod hari anda." />}</div></Card><Card><div className="flex items-center justify-between"><div><h3 className="font-bold text-white">Baki cuti</h3><p className="mt-1 text-xs text-slate-500">Tahun {yearLocal()}</p></div><button onClick={() => setActive('leave')} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-slate-300"><Plus size={17} /></button></div><div className="mt-5 grid gap-3">{['MC', 'EL'].map((type) => { const item = getBalance(leaves, user.id, type, balances); return <div key={type} className="rounded-2xl border border-white/10 p-3"><div className="flex items-center justify-between text-sm"><span className="font-bold text-white">{type}</span><span className="text-slate-400">{item.used} / {item.limit} hari</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-electric" style={{ width: `${Math.min(100, (item.used / Math.max(1, item.limit)) * 100)}%` }} /></div><div className="mt-2 text-xs text-slate-500">Baki {item.remaining} hari</div></div> })}</div></Card></div></div>
}

function getBalance(leaves, staffId, type, balances = []) {
  const limit = balances.find((item) => item.staff_id === staffId && item.year === yearLocal() && item.type === type)?.limit_days ?? 14
  const used = leaves.filter((item) => item.staff_id === staffId && item.type === type && item.status === 'Approved').reduce((total, item) => total + dateDays(item.start_date, item.end_date), 0)
  return { limit, used, remaining: Math.max(0, limit - used) }
}

function dateDays(start, end) {
  if (!start || !end) return 0
  return Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 864e5) + 1
}

function LeavePage({ user, leaves, balances, onSubmit, onCancel }) {
  const [form, setForm] = useState({ type: 'MC', start_date: todayLocal(), end_date: todayLocal(), reason: '', attachment: null })
  const [error, setError] = useState('')
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.type === 'file' ? event.target.files[0] : event.target.value }))
  const own = leaves.filter((item) => item.staff_id === user.id)
  async function submit(event) { event.preventDefault(); setError(''); const result = await onSubmit(form); if (result?.error) setError(result.error); else setForm({ type: 'MC', start_date: todayLocal(), end_date: todayLocal(), reason: '', attachment: null }) }
  return <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><div className="grid gap-5"><Card><div className="flex items-start justify-between"><div><Badge tone="blue">Tahun {yearLocal()}</Badge><h2 className="mt-3 text-xl font-black text-white">Baki cuti saya</h2><p className="mt-1 text-sm text-slate-500">Permohonan yang diluluskan akan ditolak automatik.</p></div><Palmtree className="text-lime" size={22} /></div><div className="mt-5 grid grid-cols-2 gap-3">{['MC', 'EL'].map((type) => { const item = getBalance(leaves, user.id, type, balances); return <div key={type} className="rounded-2xl bg-white/[.04] p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{type}</div><div className="mt-2 text-2xl font-black text-white">{item.remaining}<span className="ml-1 text-sm font-medium text-slate-500">hari</span></div><div className="mt-1 text-xs text-slate-500">Digunakan {item.used} / {item.limit}</div></div> })}</div></Card><Card><div className="mb-4"><h3 className="font-bold text-white">Mohon cuti</h3><p className="mt-1 text-xs text-slate-500">Isi permohonan MC atau EL dengan tarikh yang tepat.</p></div><form onSubmit={submit} className="grid gap-4"><Field label="Jenis cuti"><Select value={form.type} onChange={update('type')}><option>MC</option><option>EL</option></Select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Tarikh mula"><Input type="date" value={form.start_date} onChange={update('start_date')} required /></Field><Field label="Tarikh akhir"><Input type="date" value={form.end_date} onChange={update('end_date')} required /></Field></div><Field label="Sebab"><textarea value={form.reason} onChange={update('reason')} required rows="3" className="w-full resize-none rounded-2xl border border-white/10 bg-ink/60 p-3.5 text-sm text-white outline-none focus:border-electric/70" placeholder="Contoh: demam dan perlu rehat" /></Field><Field label="Lampiran MC" hint="Pilihan · gambar atau PDF"><Input type="file" accept="image/*,.pdf" onChange={update('attachment')} className="file:mr-3 file:rounded-lg file:border-0 file:bg-electric/20 file:px-2 file:py-1 file:text-xs file:font-bold file:text-electric" /></Field>{error && <div className="rounded-2xl bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}<Button type="submit" className="w-full"><Plus size={17} /> Hantar permohonan</Button></form></Card></div><Card><div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-white">Sejarah permohonan</h2><p className="mt-1 text-sm text-slate-500">Status dan remark daripada admin.</p></div><CalendarDays className="text-electric" size={22} /></div><div className="mt-5 grid gap-3">{own.map((item) => <div key={item.id} className="rounded-2xl border border-white/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-bold text-white">{item.type}</span><Badge tone={item.status === 'Approved' ? 'green' : item.status === 'Rejected' ? 'red' : 'amber'}>{item.status === 'Approved' ? 'Diluluskan' : item.status === 'Rejected' ? 'Ditolak' : 'Pending'}</Badge></div><div className="mt-2 text-sm text-slate-300">{formatDate(item.start_date)} — {formatDate(item.end_date)}</div><div className="mt-1 text-sm text-slate-500">{item.reason}</div></div><div className="text-right text-xs text-slate-500">{dateDays(item.start_date, item.end_date)} hari</div></div>{item.remark && <div className="mt-3 rounded-xl bg-white/[.04] p-3 text-xs text-slate-400">Remark admin: {item.remark}</div>}{item.attachment_name && <div className="mt-3 text-xs text-electric">Lampiran: {item.attachment_name}</div>}{item.status === 'Pending' && <Button variant="danger" className="mt-4 min-h-9" onClick={() => onCancel(item.id)}><XCircle size={15} /> Batalkan</Button>}</div>)}{!own.length && <Empty title="Belum ada permohonan" text="Bila perlu cuti, hantar permohonan melalui borang sebelah." />}</div></Card></div>
}

function AdminOverview({ users, attendance, leaves, setActive }) {
  const staff = users.filter((item) => item.role === 'staff' && item.is_active)
  const pending = leaves.filter((item) => item.status === 'Pending').length
  const present = staff.filter((person) => attendance.filter((item) => item.staff_id === person.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.type === 'in').length
  return <div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Staff aktif" value={staff.length} hint="Akaun aktif" icon={Users} /><StatCard label="Sedang bekerja" value={present} hint="Clock in belum out" tone="green" icon={Zap} /><StatCard label="Cuti pending" value={pending} hint="Perlu tindakan" tone="amber" icon={Palmtree} /><StatCard label="Audit tersedia" value={attendance.filter((item) => item.edited).length} hint="Rekod diedit admin" icon={ShieldCheck} /></div><div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]"><Card><div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-white">Keadaan hari ini</h2><p className="mt-1 text-sm text-slate-500">Ringkasan operasi mengikut staff.</p></div><Button variant="secondary" onClick={() => setActive('attendance')}>Buka laporan <ArrowRight size={15} /></Button></div><div className="mt-5 grid gap-2">{staff.map((person) => { const last = attendance.filter((item) => item.staff_id === person.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]; const onLeave = leaves.some((item) => item.staff_id === person.id && item.status === 'Approved' && item.start_date <= todayLocal() && item.end_date >= todayLocal()); return <div key={person.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] p-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-electric/15 font-black text-electric">{person.nickname.slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="font-semibold text-white">{person.nickname}</div><div className="text-xs text-slate-500">{person.full_name}</div></div>{onLeave ? <Badge tone="blue">Cuti</Badge> : last?.type === 'in' ? <Badge tone="green">Bekerja · {formatTime(last.timestamp)}</Badge> : <Badge tone="neutral">Belum clock in</Badge>}</div> })}{!staff.length && <Empty title="Belum ada staff" text="Akaun staff yang daftar akan muncul di sini." />}</div></Card><Card><h3 className="font-bold text-white">Tindakan pantas</h3><div className="mt-4 grid gap-2"><Button variant="secondary" className="justify-start" onClick={() => setActive('leave-admin')}><Palmtree size={17} /> Semak cuti pending</Button><Button variant="secondary" className="justify-start" onClick={() => setActive('attendance')}><Download size={17} /> Eksport CSV</Button><Button variant="secondary" className="justify-start" onClick={() => setActive('settings')}><Settings size={17} /> Semak lokasi workshop</Button></div><div className="mt-6 rounded-2xl bg-lime/10 p-4"><div className="flex items-center gap-2 text-sm font-bold text-lime"><ShieldCheck size={16} /> Akses admin aktif</div><p className="mt-2 text-xs leading-relaxed text-slate-400">Semua edit rekod wajib ada sebab dan direkod dalam audit log.</p></div></Card></div></div>
}

function PeoplePage({ users, balances, onToggle, onBalanceSave }) {
  return <Card><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">Kakitangan</h2><p className="mt-1 text-sm text-slate-500">Urus akses dan limit cuti tahunan staff.</p></div><Badge tone="blue">{users.filter((item) => item.role === 'staff').length} staff</Badge></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Nama</th><th className="pb-3">Email</th><th className="pb-3">Limit MC / EL</th><th className="pb-3">Status</th><th className="pb-3 text-right">Tindakan</th></tr></thead><tbody className="divide-y divide-white/5">{users.map((person) => <tr key={person.id}><td className="py-4"><div className="font-bold text-white">{person.nickname}</div><div className="text-xs text-slate-500">{person.full_name} · {person.role}</div></td><td className="py-4 text-slate-400">{person.email}</td><td className="py-4">{person.role === 'staff' && <div className="flex gap-2"><Input aria-label={`${person.nickname} MC`} className="min-h-9 w-20 px-2 text-center" type="number" min="0" defaultValue={getBalance([], person.id, 'MC', balances).limit} onBlur={(e) => onBalanceSave(person.id, 'MC', e.target.value)} /><Input aria-label={`${person.nickname} EL`} className="min-h-9 w-20 px-2 text-center" type="number" min="0" defaultValue={getBalance([], person.id, 'EL', balances).limit} onBlur={(e) => onBalanceSave(person.id, 'EL', e.target.value)} /></div>}</td><td className="py-4"><Badge tone={person.is_active ? 'green' : 'red'}>{person.is_active ? 'Aktif' : 'Dinonaktifkan'}</Badge></td><td className="py-4 text-right">{person.role === 'staff' && <Button variant={person.is_active ? 'danger' : 'secondary'} className="min-h-9" onClick={() => onToggle(person.id)}>{person.is_active ? 'Nyahaktif' : 'Aktifkan'}</Button>}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-slate-500">MC dan EL: masukkan limit hari dan keluar dari medan untuk simpan.</p></Card>
}

function AttendancePage({ users, attendance, onSave, onDelete }) {
  const [range, setRange] = useState('daily')
  const [editor, setEditor] = useState(null)
  const staff = users.filter((item) => item.role === 'staff')
  const sorted = [...attendance].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  function openEditor(item) { setEditor(item ? { ...item, date: item.timestamp.slice(0, 10), time: item.timestamp.slice(11, 16), reason: '' } : { staff_id: staff[0]?.id || '', type: 'in', date: todayLocal(), time: '08:00', reason: '' }) }
  function submit(event) { event.preventDefault(); if (!editor.reason.trim()) return; onSave({ ...editor, timestamp: `${editor.date}T${editor.time}:00+08:00` }); setEditor(null) }
  return <div className="grid gap-5"><Card><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-black text-white">Laporan kehadiran</h2><p className="mt-1 text-sm text-slate-500">Semak, edit, dan eksport rekod dalam waktu Malaysia.</p></div><div className="flex flex-wrap gap-2"><div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">{[['daily', 'Harian'], ['weekly', 'Mingguan'], ['monthly', 'Bulanan']].map(([value, label]) => <button key={value} onClick={() => setRange(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${range === value ? 'bg-electric text-ink' : 'text-slate-400'}`}>{label}</button>)}</div><Button variant="secondary" onClick={() => downloadCsv(`kehadiran-${todayLocal()}.csv`, [['Nama penuh', 'Jenis', 'Masa', 'Jarak (m)', 'Status'], ...sorted.map((item) => [users.find((u) => u.id === item.staff_id)?.full_name, item.type, formatTime(item.timestamp), item.distance_m, item.edited ? 'Diedit oleh admin' : 'Asal'])])}><Download size={16} /> CSV</Button><Button onClick={() => openEditor()}><Plus size={16} /> Tambah</Button></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3">Staff</th><th className="pb-3">Jenis</th><th className="pb-3">Masa</th><th className="pb-3">Lokasi</th><th className="pb-3">Status</th><th className="pb-3 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-white/5">{sorted.map((item) => <tr key={item.id}><td className="py-4 font-bold text-white">{users.find((u) => u.id === item.staff_id)?.nickname || '—'}</td><td className="py-4"><Badge tone={item.type === 'in' ? 'green' : 'blue'}>{item.type === 'in' ? 'Clock In' : 'Clock Out'}</Badge></td><td className="py-4 text-slate-300">{formatDate(item.timestamp)}<div className="text-xs text-slate-500">{formatTime(item.timestamp)}</div></td><td className="py-4 text-slate-400">{item.distance_m}m dari workshop</td><td className="py-4">{item.edited ? <Badge tone="amber">Diedit oleh admin</Badge> : <Badge>Asal</Badge>}</td><td className="py-4 text-right"><button className="mr-2 text-xs font-bold text-electric hover:text-white" onClick={() => openEditor(item)}>Edit</button><button className="text-xs font-bold text-red-200 hover:text-red-100" onClick={() => onDelete(item)}>Padam</button></td></tr>)}</tbody></table></div></Card>{editor && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto"><div className="flex items-start justify-between"><div><Badge tone="amber">Admin override</Badge><h2 className="mt-3 text-xl font-black text-white">{editor.id ? 'Edit rekod' : 'Tambah rekod'}</h2><p className="mt-1 text-sm text-slate-500">Sebab wajib untuk setiap perubahan.</p></div><button onClick={() => setEditor(null)} className="rounded-xl p-2 text-slate-500 hover:bg-white/5"><X size={18} /></button></div><form onSubmit={submit} className="mt-5 grid gap-4"><Field label="Staff"><Select value={editor.staff_id} onChange={(e) => setEditor({ ...editor, staff_id: e.target.value })}>{staff.map((person) => <option key={person.id} value={person.id}>{person.nickname} · {person.full_name}</option>)}</Select></Field><Field label="Jenis"><Select value={editor.type} onChange={(e) => setEditor({ ...editor, type: e.target.value })}><option value="in">Clock In</option><option value="out">Clock Out</option></Select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Tarikh"><Input type="date" value={editor.date} onChange={(e) => setEditor({ ...editor, date: e.target.value })} /></Field><Field label="Masa"><Input type="time" value={editor.time} onChange={(e) => setEditor({ ...editor, time: e.target.value })} /></Field></div><Field label="Sebab perubahan"><textarea required rows="3" value={editor.reason} onChange={(e) => setEditor({ ...editor, reason: e.target.value })} className="w-full resize-none rounded-2xl border border-white/10 bg-ink/60 p-3.5 text-sm text-white outline-none focus:border-electric/70" placeholder="Contoh: Staff terlupa clock out." /></Field><div className="flex gap-2"><Button type="button" variant="secondary" className="flex-1" onClick={() => setEditor(null)}>Batal</Button><Button type="submit" className="flex-1"><Check size={16} /> Simpan & audit</Button></div></form></Card></div>}</div>
}

function LeaveAdminPage({ users, leaves, balances, onDecision }) {
  const [remark, setRemark] = useState({})
  const pending = leaves.filter((item) => item.status === 'Pending')
  return <div className="grid gap-5"><Card><div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-white">Permohonan cuti</h2><p className="mt-1 text-sm text-slate-500">Semak balance sebelum approve.</p></div><Badge tone="amber">{pending.length} pending</Badge></div><div className="mt-5 grid gap-3">{pending.map((item) => { const person = users.find((u) => u.id === item.staff_id); const balance = getBalance(leaves, item.staff_id, item.type, balances); const days = dateDays(item.start_date, item.end_date); return <div key={item.id} className="rounded-2xl border border-white/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-electric/15 font-black text-electric">{person?.nickname?.slice(0, 1)}</div><div><div className="font-bold text-white">{person?.nickname} <span className="ml-2 align-middle"><Badge tone="blue">{item.type}</Badge></span></div><div className="mt-1 text-sm text-slate-300">{formatDate(item.start_date)} — {formatDate(item.end_date)} · {days} hari</div><div className="mt-1 text-sm text-slate-500">{item.reason}</div>{item.attachment_name && <div className="mt-2 text-xs text-electric">Lampiran: {item.attachment_name}</div>}</div></div><div className="text-right text-xs text-slate-500">Baki sebelum: <b className="text-white">{balance.remaining} hari</b></div></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><Input placeholder="Remark (pilihan)" value={remark[item.id] || ''} onChange={(e) => setRemark({ ...remark, [item.id]: e.target.value })} /><Button variant="danger" onClick={() => onDecision(item.id, 'Rejected', remark[item.id] || '')}><X size={15} /> Tolak</Button><Button variant="lime" disabled={days > balance.remaining} onClick={() => onDecision(item.id, 'Approved', remark[item.id] || '')}><Check size={15} /> Lulus</Button></div>{days > balance.remaining && <div className="mt-3 text-xs text-red-200">Permohonan melebihi baki {item.type}. Butang approve dikunci.</div>}</div> })}{!pending.length && <Empty title="Tiada permohonan pending" text="Semua permohonan sudah disemak." />}</div></Card><Card><h3 className="font-bold text-white">Sejarah keputusan</h3><div className="mt-4 grid gap-2">{leaves.filter((item) => item.status !== 'Pending').map((item) => <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] p-3"><div className="flex-1"><div className="text-sm font-semibold text-white">{users.find((u) => u.id === item.staff_id)?.nickname} · {item.type}</div><div className="text-xs text-slate-500">{formatDate(item.start_date)} — {formatDate(item.end_date)}</div></div><Badge tone={item.status === 'Approved' ? 'green' : 'red'}>{item.status === 'Approved' ? 'Diluluskan' : 'Ditolak'}</Badge></div>)}{!leaves.some((item) => item.status !== 'Pending') && <div className="text-sm text-slate-500">Belum ada sejarah keputusan.</div>}</div></Card></div>
}

function SettingsPage({ settings, onSave }) {
  const [form, setForm] = useState(settings)
  return <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><Card><Badge tone="blue">Workshop</Badge><h2 className="mt-3 text-xl font-black text-white">Tetapan lokasi</h2><p className="mt-1 text-sm text-slate-500">Staff hanya boleh clock in/out dalam radius yang ditetapkan.</p><form className="mt-5 grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, workshop_lat: Number(form.workshop_lat), workshop_lng: Number(form.workshop_lng), radius_m: Number(form.radius_m) }) }}><Field label="Latitude"><Input type="number" step="any" value={form.workshop_lat} onChange={(e) => setForm({ ...form, workshop_lat: e.target.value })} /></Field><Field label="Longitude"><Input type="number" step="any" value={form.workshop_lng} onChange={(e) => setForm({ ...form, workshop_lng: e.target.value })} /></Field><Field label="Radius dibenarkan (meter)"><Input type="number" min="10" value={form.radius_m} onChange={(e) => setForm({ ...form, radius_m: e.target.value })} /></Field><Button type="submit"><Check size={16} /> Simpan tetapan</Button></form></Card><Card><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-electric/15 text-electric"><MapPin size={19} /></div><div><h3 className="font-bold text-white">Cara dapatkan koordinat</h3><p className="mt-1 text-sm leading-relaxed text-slate-400">Buka Google Maps di lokasi workshop, tekan lama pada titik workshop dan salin latitude/longitude. Semak radius ikut keluasan kawasan parkir.</p></div></div><div className="mt-5 rounded-2xl bg-white/[.04] p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Koordinat aktif</div><div className="mt-2 font-mono text-sm text-electric">{Number(form.workshop_lat).toFixed(5)}, {Number(form.workshop_lng).toFixed(5)}</div><div className="mt-1 text-xs text-slate-500">Radius {form.radius_m} meter · Waktu Malaysia</div></div><div className="mt-5 rounded-2xl border border-ember/20 bg-ember/10 p-4 text-sm text-ember">Uji clock in selepas simpan tetapan supaya staff tidak tersekat oleh koordinat lama.</div></Card></div>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [active, setActive] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [attendance, setAttendance] = useState(() => readDemo('attendance', seedAttendance()))
  const [leaves, setLeaves] = useState(() => readDemo('leaves', seedLeaves()))
  const [users, setUsers] = useState(() => readDemo('users', demoUsers))
  const [balances, setBalances] = useState(() => readDemo('balances', seedBalances()))
  const [settings, setSettings] = useState(() => readDemo('settings', defaultSettings))
  const [jobCards, setJobCards] = useState(() => readDemo('jobCards', []))
  const [vehicles, setVehicles] = useState(() => readDemo('vehicles', []))
  const [notice, setNotice] = useState({})

  useEffect(() => { const saved = readDemo('session', null); if (saved) setUser(saved) }, [])
  useEffect(() => { if (user?.role === 'admin' && !active) setActive('overview'); else if (user && !active) setActive('dashboard') }, [user, active])
  useEffect(() => { writeDemo('attendance', attendance) }, [attendance])
  useEffect(() => { writeDemo('leaves', leaves) }, [leaves])
  useEffect(() => { writeDemo('users', users) }, [users])
  useEffect(() => { writeDemo('balances', balances) }, [balances])
  useEffect(() => { writeDemo('settings', settings) }, [settings])
  useEffect(() => { writeDemo('jobCards', jobCards) }, [jobCards])
  useEffect(() => { writeDemo('vehicles', vehicles) }, [vehicles])
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}) }, [])
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return
    let cancelled = false
    ;(async () => {
      const [profileResult, attendanceResult, leaveResult, settingsResult, balancesResult] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('attendance').select('*').order('timestamp', { ascending: false }),
        supabase.from('leave_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('settings').select('*').eq('id', 1).single(),
        supabase.from('leave_balances').select('*').eq('year', yearLocal()),
      ])
      if (cancelled) return
      if (profileResult.data) setUsers(profileResult.data)
      if (attendanceResult.data) setAttendance(attendanceResult.data.map((item) => ({ ...item, edited: item.edited_by_admin })))
      if (leaveResult.data) setLeaves(leaveResult.data.map((item) => ({ ...item, attachment_name: item.attachment_path, remark: item.admin_remark })))
      if (settingsResult.data) setSettings(settingsResult.data)
      if (balancesResult.data) setBalances(balancesResult.data)
    })()
    return () => { cancelled = true }
  }, [user])

  async function refreshJobCards() {
    if (!isSupabaseConfigured) return
    const [jobsResult, vehiclesResult, itemsResult, partsResult, historyResult, photosResult] = await Promise.all([
      supabase.from('job_cards').select('*').order('check_in_date', { ascending: false }),
      supabase.from('vehicles').select('*').order('plate_no'),
      supabase.from('job_items').select('*'),
      supabase.from('job_parts').select('*'),
      supabase.from('job_status_history').select('*').order('changed_at', { ascending: false }),
      supabase.from('job_photos').select('*').order('uploaded_at', { ascending: false }),
    ])
    if (jobsResult.error) { setNotice({ type: 'error', message: jobsResult.error.message }); return }
    const itemsByJob = (itemsResult.data || []).reduce((all, item) => ({ ...all, [item.job_id]: [...(all[item.job_id] || []), item] }), {})
    const partsByJob = (partsResult.data || []).reduce((all, item) => ({ ...all, [item.job_id]: [...(all[item.job_id] || []), item] }), {})
    const historyByJob = (historyResult.data || []).reduce((all, item) => ({ ...all, [item.job_id]: [...(all[item.job_id] || []), item] }), {})
    const photosByJob = (photosResult.data || []).reduce((all, item) => ({ ...all, [item.job_id]: [...(all[item.job_id] || []), item] }), {})
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
      job_photos: (photosByJob[job.id] || []).map((photo) => ({ ...photo, signed_url: signedById[photo.id] })),
    })))
  }

  useEffect(() => { if (user) refreshJobCards() }, [user])

  function login(nextUser) { const merged = users.find((item) => item.id === nextUser.id) || nextUser; setUser(merged); writeDemo('session', merged); setActive(merged.role === 'admin' ? 'overview' : 'dashboard') }
  async function signOut() { if (isSupabaseConfigured) await supabase.auth.signOut(); localStorage.removeItem('zordaq:session'); setUser(null); setActive(null) }
  async function clock(type) {
    setNotice({ busy: true })
    try {
      const last = attendance.filter((item) => item.staff_id === user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
      if (type === 'in' && last?.type === 'in') throw new Error('Anda sudah clock in. Sila clock out dahulu.')
      if (type === 'out' && last?.type !== 'in') throw new Error('Anda belum clock in.')
      let position
      try { position = await getBrowserPosition() } catch (error) { if (isSupabaseConfigured) throw error; position = { coords: { latitude: settings.workshop_lat, longitude: settings.workshop_lng } } }
      const { latitude, longitude } = position.coords
      const distance = haversineDistance(latitude, longitude, settings.workshop_lat, settings.workshop_lng)
      if (distance > settings.radius_m) throw new Error(`Anda berada ${distance}m dari workshop. Had dibenarkan ialah ${settings.radius_m}m.`)
      const item = { id: `att-${Date.now()}`, staff_id: user.id, type, timestamp: nowIso(), lat: latitude, lng: longitude, distance_m: distance, edited: false }
      if (isSupabaseConfigured) { const { data, error } = await supabase.from('attendance').insert({ staff_id: item.staff_id, type: item.type, timestamp: item.timestamp, lat: item.lat, lng: item.lng, distance_m: item.distance_m }).select().single(); if (error) throw error; item.id = data.id }
      setAttendance((prev) => [...prev, item]); setNotice({ type: 'success', message: `Clock ${type === 'in' ? 'In' : 'Out'} berjaya direkod pada ${formatTime(item.timestamp)}.` })
    } catch (error) { setNotice({ type: 'error', message: error.message }) } finally { setNotice((prev) => ({ ...prev, busy: false })) }
  }
  async function submitLeave(form) {
    if (form.end_date < form.start_date) return { error: 'Tarikh akhir mesti selepas tarikh mula.' }
    const days = dateDays(form.start_date, form.end_date); const balance = getBalance(leaves, user.id, form.type, balances)
    if (days > balance.remaining) return { error: `Permohonan melebihi baki ${form.type}. Baki anda tinggal ${balance.remaining} hari.` }
    let attachmentName = form.attachment?.name || ''
    if (isSupabaseConfigured && form.attachment) { const path = `${user.id}/${Date.now()}-${form.attachment.name}`; const { error } = await supabase.storage.from('leave-attachments').upload(path, form.attachment); if (error) return { error: error.message }; attachmentName = path }
    const item = { id: `leave-${Date.now()}`, staff_id: user.id, type: form.type, start_date: form.start_date, end_date: form.end_date, reason: form.reason, status: 'Pending', remark: '', attachment_name: attachmentName }
    if (isSupabaseConfigured) { const { data, error } = await supabase.from('leave_requests').insert({ staff_id: item.staff_id, type: item.type, start_date: item.start_date, end_date: item.end_date, reason: item.reason, status: item.status, attachment_path: attachmentName || null }).select().single(); if (error) return { error: error.message }; item.id = data.id }
    setLeaves((prev) => [item, ...prev]); setNotice({ type: 'success', message: 'Permohonan cuti berjaya dihantar.' }); return {}
  }
  function cancelLeave(id) { if (!window.confirm('Batalkan permohonan ini?')) return; setLeaves((prev) => prev.filter((item) => item.id !== id)) }
  async function decideLeave(id, status, remark) { if (isSupabaseConfigured) await supabase.from('leave_requests').update({ status, admin_remark: remark || null, decided_by: user.id, decided_at: nowIso() }).eq('id', id); setLeaves((prev) => prev.map((item) => item.id === id ? { ...item, status, remark } : item)) }
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
  async function deleteAttendance(item) { const reason = window.prompt('Sebab wajib untuk padam rekod:'); if (!reason?.trim()) return; if (isSupabaseConfigured) { const result = await supabase.from('attendance').delete().eq('id', item.id); if (result.error) { setNotice({ type: 'error', message: result.error.message }); return }; await supabase.from('attendance_audit_log').insert({ attendance_id: item.id, edited_by: user.id, old_value: item, new_value: null, reason }) }; setAttendance((prev) => prev.filter((record) => record.id !== item.id)) }
  async function toggleUser(id) { const target = users.find((item) => item.id === id); if (!target) return; const is_active = !target.is_active; if (isSupabaseConfigured) { const { error } = await supabase.from('profiles').update({ is_active }).eq('id', id); if (error) { setNotice({ type: 'error', message: error.message }); return } }; setUsers((prev) => prev.map((item) => item.id === id ? { ...item, is_active } : item)) }
  async function saveBalance(staffId, type, value) { const limit_days = Math.max(0, Number(value) || 0); const existing = balances.find((item) => item.staff_id === staffId && item.year === yearLocal() && item.type === type); if (isSupabaseConfigured) { const { data, error } = await supabase.from('leave_balances').upsert({ id: existing?.id, staff_id: staffId, year: yearLocal(), type, limit_days }).select().single(); if (error) { setNotice({ type: 'error', message: error.message }); return }; setBalances((prev) => [...prev.filter((item) => item.id !== existing?.id && !(item.staff_id === staffId && item.year === yearLocal() && item.type === type)), data]) } else { setBalances((prev) => [...prev.filter((item) => !(item.staff_id === staffId && item.year === yearLocal() && item.type === type)), { id: existing?.id || `bal-${Date.now()}`, staff_id: staffId, year: yearLocal(), type, limit_days }]) } }

  async function saveJobCard(form) {
    const plate = normalizePlateNo(form.plate_no)
    if (!plate) { setNotice({ type: 'error', message: 'Masukkan nombor pendaftaran.' }); return { error: 'plate' } }
    if (!form.customer_complaint?.trim()) { setNotice({ type: 'error', message: 'Masukkan aduan pelanggan.' }); return { error: 'complaint' } }
    try {
      if (!isSupabaseConfigured) {
        const vehicle = vehicles.find((item) => normalizePlateNo(item.plate_no) === plate) || { plate_no: plate, car_model: form.car_model || '', visit_count: 0 }
        const id = form.id || `job-${Date.now()}`
        const current = jobCards.find((item) => item.id === id)
        const item = { ...form, id, plate_no: plate, vehicles: { ...vehicle, car_model: form.car_model || vehicle.car_model }, job_items: (form.job_items || []).filter((row) => row.description?.trim()), job_parts: (form.job_parts || []).filter((row) => row.name?.trim()), job_status_history: current?.job_status_history || [{ id: `history-${Date.now()}`, old_status: null, new_status: form.status, changed_by: user.id, changed_at: nowIso() }], job_photos: current?.job_photos || [] }
        setJobCards((prev) => form.id ? prev.map((row) => row.id === form.id ? item : row) : [item, ...prev])
        setVehicles((prev) => prev.some((row) => normalizePlateNo(row.plate_no) === plate) ? prev.map((row) => normalizePlateNo(row.plate_no) === plate ? { ...row, car_model: form.car_model || row.car_model, visit_count: form.id ? row.visit_count : row.visit_count + 1 } : row) : [...prev, { ...vehicle, car_model: form.car_model || vehicle.car_model, visit_count: 1 }])
        setNotice({ type: 'success', message: form.id ? 'Job card dikemas kini.' : 'Job card berjaya dicipta.' })
        return {}
      }
      let vehicle = vehicles.find((item) => normalizePlateNo(item.plate_no) === plate)
      if (user.role === 'admin') {
        const vehicleResult = await supabase.from('vehicles').upsert({ plate_no: plate, car_model: form.car_model || '' }).select().single()
        if (vehicleResult.error) throw vehicleResult.error
        vehicle = vehicleResult.data
      }
      const payload = form.isStaffEdit
        ? { status: form.status, notes: form.notes || null }
        : { plate_no: plate, customer_complaint: form.customer_complaint.trim(), check_in_date: form.check_in_date, status: form.status, notes: form.notes || null, assigned_staff: form.assigned_staff || null, created_by: user.id }
      const jobResult = form.id
        ? await supabase.from('job_cards').update(payload).eq('id', form.id).select().single()
        : await supabase.from('job_cards').insert(payload).select().single()
      if (jobResult.error) throw jobResult.error
      const jobId = jobResult.data.id
      await supabase.from('job_items').delete().eq('job_id', jobId)
      const itemRows = (form.job_items || []).filter((row) => row.description?.trim()).map((row) => ({ job_id: jobId, description: row.description.trim(), is_done: Boolean(row.is_done) }))
      if (itemRows.length) { const result = await supabase.from('job_items').insert(itemRows); if (result.error) throw result.error }
      if (user.role === 'admin') {
        await supabase.from('job_parts').delete().eq('job_id', jobId)
        const partRows = (form.job_parts || []).filter((row) => row.name?.trim()).map((row) => ({ job_id: jobId, name: row.name.trim(), qty: Math.max(1, Number(row.qty) || 1) }))
        if (partRows.length) { const result = await supabase.from('job_parts').insert(partRows); if (result.error) throw result.error }
      }
      await refreshJobCards()
      setNotice({ type: 'success', message: form.id ? 'Job card dikemas kini.' : 'Job card berjaya dicipta.' })
      return {}
    } catch (error) { setNotice({ type: 'error', message: error.message || 'Job card tidak dapat disimpan.' }); return { error: error.message } }
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
      setNotice({ type: 'success', message: `${files.length} gambar berjaya dimuat naik.` })
    } catch (error) { setNotice({ type: 'error', message: error.message || 'Gambar tidak dapat dimuat naik.' }) }
  }

  async function deleteJobPhoto(photo) {
    if (!window.confirm('Padam gambar ini?')) return
    try {
      if (isSupabaseConfigured) { const result = await supabase.from('job_photos').delete().eq('id', photo.id); if (result.error) throw result.error; await supabase.storage.from('job-photos').remove([photo.file_path]); await refreshJobCards() }
      else setJobCards((prev) => prev.map((job) => ({ ...job, job_photos: (job.job_photos || []).filter((item) => item.id !== photo.id) })))
      setNotice({ type: 'success', message: 'Gambar dipadam.' })
    } catch (error) { setNotice({ type: 'error', message: error.message || 'Gambar tidak dapat dipadam.' }) }
  }

  if (!user) return <AuthScreen onLogin={login} />
  const titles = { dashboard: 'Hari ini', leave: 'Cuti saya', overview: 'Ringkasan operasi', people: 'Kakitangan', attendance: 'Kehadiran', 'leave-admin': 'Permohonan cuti', settings: 'Tetapan workshop', 'job-cards': 'Job Cards', 'vehicle-history': 'Sejarah Kereta' }
  let page
  if (active === 'dashboard') page = <StaffDashboard user={user} attendance={attendance} settings={settings} leaves={leaves} balances={balances} onClock={clock} notice={notice} setActive={setActive} />
  if (active === 'leave') page = <LeavePage user={user} leaves={leaves} balances={balances} onSubmit={submitLeave} onCancel={cancelLeave} />
  if (active === 'overview') page = <AdminOverview users={users} attendance={attendance} leaves={leaves} setActive={setActive} />
  if (active === 'people') page = <PeoplePage users={users} balances={balances} onToggle={toggleUser} onBalanceSave={saveBalance} />
  if (active === 'attendance') page = <AttendancePage users={users} attendance={attendance} onSave={saveAttendance} onDelete={deleteAttendance} />
  if (active === 'leave-admin') page = <LeaveAdminPage users={users} leaves={leaves} balances={balances} onDecision={decideLeave} />
  if (active === 'settings') page = <SettingsPage settings={settings} onSave={(value) => { setSettings(value); setNotice({ type: 'success', message: 'Tetapan lokasi disimpan.' }) }} />
  if (active === 'job-cards') page = <JobCardsPage user={user} users={users} jobs={jobCards} vehicles={vehicles} onSave={saveJobCard} onUpload={uploadJobPhotos} onDeletePhoto={deleteJobPhoto} />
  if (active === 'vehicle-history') page = <JobCardsPage user={user} users={users} jobs={jobCards} vehicles={vehicles} isHistoryPage onSave={saveJobCard} onUpload={uploadJobPhotos} onDeletePhoto={deleteJobPhoto} />
  return <div className="min-h-screen bg-ink text-white lg:flex"><Sidebar user={user} active={active} setActive={setActive} onSignOut={signOut} open={menuOpen} setOpen={setMenuOpen} /><div className="min-w-0 flex-1"><Header user={user} title={titles[active]} onMenu={() => setMenuOpen(true)} /><main className="mx-auto max-w-7xl p-4 pb-24 sm:p-8">{notice.message && active !== 'dashboard' && <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-300/20 bg-red-400/10 text-red-100' : 'border-lime/20 bg-lime/10 text-lime'}`}>{notice.message}</div>}{page}</main><div className="fixed bottom-4 right-4 hidden items-center gap-2 rounded-full border border-white/10 bg-panel/90 px-3 py-2 text-[11px] text-slate-400 shadow-xl sm:flex"><span className="h-2 w-2 rounded-full bg-lime" /> Asia/Kuala Lumpur</div></div></div>
}
