import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import { todayLocal } from '../lib/date'

const STATUSES = ['Pending Review', 'Confirmed', 'Completed', 'Cancelled']
const STATUS_STYLES = {
  'Pending Review': { event: 'bg-amber-400 text-slate-950', badge: 'bg-amber-400/15 text-amber-300', dot: 'bg-amber-400' },
  Confirmed: { event: 'bg-electric text-slate-950', badge: 'bg-electric/15 text-electric', dot: 'bg-electric' },
  Completed: { event: 'bg-lime text-slate-950', badge: 'bg-lime/15 text-lime', dot: 'bg-lime' },
  Cancelled: { event: 'bg-red-400 text-slate-950', badge: 'bg-red-400/15 text-red-200', dot: 'bg-red-400' },
}

function pad(value) { return String(value).padStart(2, '0') }
function monthKey(year, month) { return `${year}-${pad(month + 1)}` }
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }
function mondayOffset(year, month) { return (new Date(year, month, 1).getDay() + 6) % 7 }
function titleCase(value) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : value }

function Field({ label, children }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-200"><span>{label}</span>{children}</label>
}

function Input({ className = '', ...props }) {
  return <input className={`min-h-11 w-full rounded-2xl border border-white/10 bg-ink/60 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-electric/70 focus:ring-2 focus:ring-electric/20 ${className}`} {...props} />
}

function Select({ children, className = '', ...props }) {
  return <select className={`min-h-11 w-full rounded-2xl border border-white/10 bg-ink/60 px-3.5 text-sm text-white outline-none focus:border-electric/70 ${className}`} {...props}>{children}</select>
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-electric text-ink hover:bg-white',
    secondary: 'border border-white/10 bg-white/5 text-white hover:bg-white/10',
    danger: 'border border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/20',
  }
  return <button className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-electric/70 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>
}

function blankAppointment(date = todayLocal(), userId = '') {
  return { appointment_date: date, customer_name: '', plate_no: '', car_model: '', job_description: '', status: 'Pending Review', created_by: userId }
}

function AppointmentModal({ appointment, user, isAdmin, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(appointment)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isNew = !appointment.id
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!form.customer_name?.trim() || !form.plate_no?.trim() || !form.job_description?.trim()) {
      setError('Customer, nombor kenderaan dan kerja perlu diisi.')
      return
    }
    setBusy(true)
    const result = await onSave({ ...form, plate_no: form.plate_no.trim().toUpperCase(), customer_name: form.customer_name.trim(), car_model: form.car_model?.trim() || '', job_description: form.job_description.trim(), updated_by: user.id })
    setBusy(false)
    if (result?.error) setError(result.error)
    else onClose()
  }

  async function remove() {
    if (!window.confirm(`Padam appointment ${form.plate_no}?`)) return
    setBusy(true)
    const result = await onDelete(form)
    setBusy(false)
    if (result?.error) setError(result.error)
    else onClose()
  }

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="my-4 w-full max-w-xl rounded-[1.75rem] border border-white/10 bg-panel p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.2em] text-electric">Appointment</div><h2 className="mt-2 text-2xl font-black text-white">{isNew ? 'New appointment' : form.plate_no}</h2><p className="mt-1 text-sm text-slate-500">{isNew ? 'Add a vehicle booking to the calendar.' : 'View or update appointment details.'}</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X size={18} /></button></div>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Appointment date"><Input required type="date" value={form.appointment_date || ''} onChange={set('appointment_date')} /></Field><Field label="Status"><Select value={form.status} onChange={set('status')}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</Select></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Customer name"><Input required value={form.customer_name || ''} onChange={set('customer_name')} placeholder="Example: Faridz" /></Field><Field label="Vehicle plate no."><Input required value={form.plate_no || ''} onChange={set('plate_no')} placeholder="Example: SJS1182H" /></Field></div>
        <Field label="Car model"><Input value={form.car_model || ''} onChange={set('car_model')} placeholder="Example: Exora" /></Field>
        <Field label="Job description"><textarea required rows="4" value={form.job_description || ''} onChange={set('job_description')} className="w-full resize-none rounded-2xl border border-white/10 bg-ink/60 p-3.5 text-sm text-white outline-none focus:border-electric/70" placeholder="Example: Timing belt set CPS" /></Field>
        {error && <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">{!isNew && isAdmin ? <Button type="button" variant="danger" onClick={remove} disabled={busy}><Trash2 size={16} /> Delete</Button> : <span /> }<div className="flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add appointment' : 'Save changes'}</Button></div></div>
      </form>
    </section>
  </div>
}

export default function AppointmentsPage({ user, appointments, onSave, onDelete }) {
  const initial = todayLocal().slice(0, 7).split('-').map(Number)
  const [year, setYear] = useState(initial[0])
  const [month, setMonth] = useState(initial[1] - 1)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const monthLabel = new Intl.DateTimeFormat('en-MY', { month: 'long', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(year, month, 1))
  const days = useMemo(() => Array.from({ length: mondayOffset(year, month) + daysInMonth(year, month) }, (_, index) => index < mondayOffset(year, month) ? null : index - mondayOffset(year, month) + 1), [year, month])
  const visibleAppointments = appointments.filter((item) => !search.trim() || `${item.plate_no} ${item.customer_name} ${item.car_model} ${item.job_description}`.toLowerCase().includes(search.trim().toLowerCase()))
  const appointmentByDate = visibleAppointments.reduce((all, item) => ({ ...all, [item.appointment_date]: [...(all[item.appointment_date] || []), item] }), {})

  function moveMonth(amount) {
    const next = new Date(year, month + amount, 1)
    setYear(next.getFullYear()); setMonth(next.getMonth())
  }
  function goToday() { const current = todayLocal().slice(0, 7).split('-').map(Number); setYear(current[0]); setMonth(current[1] - 1) }

  return <div className="grid gap-5">
    <section className="rounded-[1.5rem] border border-white/10 bg-panel/80 p-4 shadow-glow sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><CalendarDays className="text-electric" size={21} /><span className="text-xs font-bold uppercase tracking-[.2em] text-electric">Workshop schedule</span></div><h2 className="mt-3 text-2xl font-black text-white">Appointments</h2><p className="mt-1 text-sm text-slate-500">Click a vehicle plate to view or edit the full appointment.</p></div><Button onClick={() => setSelected(blankAppointment(todayLocal(), user.id))}><Plus size={16} /> New appointment</Button></div>
      <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex items-center gap-2"><Button variant="secondary" className="min-h-10 px-3" onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></Button><Button variant="secondary" className="min-h-10" onClick={goToday}>Today</Button><Button variant="secondary" className="min-h-10 px-3" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight size={18} /></Button><h3 className="ml-1 text-lg font-black text-white sm:ml-3">{titleCase(monthLabel)}</h3></div><Input value={search} onChange={(event) => setSearch(event.target.value)} className="xl:max-w-xs" placeholder="Search plate, customer or job" /></div>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">{STATUSES.map((status) => <span key={status} className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[status].dot}`} />{status}</span>)}</div>
    </section>

    <section className="w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#10131b] p-1.5 shadow-glow sm:p-3"><div className="w-full"><div className="grid grid-cols-7 gap-0.5 px-0.5 pb-1 text-center text-[9px] font-black uppercase tracking-[.08em] text-slate-500 sm:gap-2 sm:px-1 sm:pb-2 sm:text-sm sm:tracking-[.12em]">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day}>{day}</div>)}</div><div className="grid grid-cols-7 gap-0.5 sm:gap-2">{days.map((day, index) => { const date = day ? `${year}-${pad(month + 1)}-${pad(day)}` : ''; const dayItems = appointmentByDate[date] || []; const isToday = date === todayLocal(); return <div key={`${date || 'blank'}-${index}`} className={`min-h-24 min-w-0 rounded-lg border p-1 sm:min-h-40 sm:rounded-2xl sm:p-2 ${day ? 'border-white/5 bg-[#151922]' : 'border-transparent bg-transparent'}`}><div className={`mb-1 flex justify-end text-[10px] font-black sm:mb-2 sm:text-sm ${isToday ? 'ml-auto grid h-6 w-6 place-items-center rounded-full bg-electric text-ink sm:h-8 sm:w-8' : day ? 'text-slate-300' : 'text-transparent'}`}>{day || '0'}</div><div className="grid min-w-0 gap-1 sm:gap-1.5">{dayItems.map((item) => <button key={item.id} onClick={() => setSelected(item)} className={`w-full min-w-0 truncate rounded-md px-0.5 py-1 text-left text-[8px] font-black leading-3 tracking-[-.08em] shadow-sm transition hover:brightness-110 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-xs sm:leading-normal sm:tracking-normal ${STATUS_STYLES[item.status]?.event || STATUS_STYLES['Pending Review'].event}`} title={`${item.plate_no} · ${item.job_description}`}>{item.plate_no}</button>)}</div></div> })}</div></div></section>
    {selected && <AppointmentModal appointment={selected} user={user} isAdmin={user.role === 'admin'} onClose={() => setSelected(null)} onSave={onSave} onDelete={onDelete} />}
  </div>
}
