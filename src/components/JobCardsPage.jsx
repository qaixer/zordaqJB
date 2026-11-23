import { useMemo, useState } from 'react'
import { Camera, CarFront, Check, CheckCircle2, ChevronRight, ClipboardList, ExternalLink, History, ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { JOB_STATUSES, newJobCardDraft, normalizePlateNo } from '../lib/jobCards'

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

function Input({ className = '', ...props }) {
  return <input className={`min-h-11 w-full rounded-2xl border border-white/10 bg-ink/60 px-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-electric/70 focus:ring-2 focus:ring-electric/20 ${className}`} {...props} />
}

function Select({ children, className = '', ...props }) {
  return <select className={`min-h-11 w-full rounded-2xl border border-white/10 bg-ink/60 px-3.5 text-sm text-white outline-none focus:border-electric/70 ${className}`} {...props}>{children}</select>
}

function Field({ label, children, hint }) {
  return <label className="grid gap-2 text-sm font-medium text-slate-200"><span>{label}</span>{children}{hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}</label>
}

function statusLabel(status) {
  return { Baru: 'New', Diagnos: 'Diagnosing', 'Tunggu Parts': 'Waiting for Parts', 'Sedang Repair': 'Under Repair', Siap: 'Ready', Collected: 'Collected' }[status] || status
}

function statusTone(status) {
  return status === 'Collected' || status === 'Siap' ? 'green' : status === 'Tunggu Parts' ? 'amber' : status === 'Sedang Repair' ? 'blue' : 'neutral'
}

function staffName(users, id) {
  const person = users.find((item) => item.id === id)
  return person?.nickname || person?.full_name || 'Unassigned'
}

function JobEditor({ job, vehicles, users, canEditAll, onClose, onSave }) {
  const [form, setForm] = useState(job ? { ...job, car_model: job.car_model || job.vehicles?.car_model || '', job_items: job.job_items || [], job_parts: job.job_parts || [] } : newJobCardDraft(users.find((person) => person.role === 'staff')?.id || ''))
  const [saving, setSaving] = useState(false)
  const isStaffEdit = Boolean(job) && !canEditAll
  const plate = normalizePlateNo(form.plate_no)
  const vehicle = vehicles.find((item) => normalizePlateNo(item.plate_no) === plate)
  const visits = job ? vehicles.find((item) => normalizePlateNo(item.plate_no) === plate)?.visit_count : vehicles.find((item) => normalizePlateNo(item.plate_no) === plate)?.visit_count
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const setItem = (index, key, value) => setForm((current) => ({ ...current, job_items: current.job_items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }))
  const setPart = (index, key, value) => setForm((current) => ({ ...current, job_parts: current.job_parts.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }))
  async function submit(event) {
    event.preventDefault(); setSaving(true)
    const result = await onSave({ ...form, plate_no: plate, isStaffEdit })
    setSaving(false)
    if (!result?.error) onClose()
  }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 sm:p-6"><div className="mx-auto max-w-4xl"><Card className="my-2 sm:my-6">
    <div className="flex items-start justify-between gap-4"><div><Badge tone="blue">{job ? 'Edit job card' : 'New job card'}</Badge><h2 className="mt-3 text-2xl font-black text-white">{job ? normalizePlateNo(job.plate_no) : 'Register vehicle'}</h2><p className="mt-1 text-sm text-slate-500">All times use Asia/Kuala Lumpur.</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-white/5"><X size={20} /></button></div>
    <form onSubmit={submit} className="mt-6 grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Registration no."><Input required disabled={isStaffEdit} value={form.plate_no} onChange={(e) => { const value = e.target.value; const found = vehicles.find((item) => normalizePlateNo(item.plate_no) === normalizePlateNo(value)); setForm((current) => ({ ...current, plate_no: value, car_model: found?.car_model || current.car_model })) }} placeholder="Example: JRX 1234" /><span className="text-xs text-slate-500">Saved as {plate || '—'} · symbols and spaces are removed automatically.</span></Field><Field label="Car model"><Input disabled={isStaffEdit} value={form.car_model} onChange={(e) => set('car_model', e.target.value)} placeholder="Example: Honda Civic FD" />{vehicle && <span className="text-xs text-lime">This car has visited {visits ?? 0} times</span>}</Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Customer complaint"><textarea required disabled={isStaffEdit} rows="3" value={form.customer_complaint} onChange={(e) => set('customer_complaint', e.target.value)} className="w-full resize-none rounded-2xl border border-white/10 bg-ink/60 p-3.5 text-sm text-white outline-none focus:border-electric/70" placeholder="Example: Engine vibrates at idle" /></Field><div className="grid gap-4"><Field label="Check-in date"><Input type="date" required disabled={isStaffEdit} value={form.check_in_date} onChange={(e) => set('check_in_date', e.target.value)} /></Field><Field label="Assigned staff"><Select disabled={isStaffEdit} value={form.assigned_staff || ''} onChange={(e) => set('assigned_staff', e.target.value)}><option value="">Select staff</option>{users.filter((person) => person.role === 'staff' && person.is_active !== false).map((person) => <option key={person.id} value={person.id}>{person.nickname} · {person.full_name}</option>)}</Select></Field></div></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Status"><Select value={form.status} onChange={(e) => set('status', e.target.value)}>{JOB_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</Select></Field><Field label="Mechanic notes"><textarea rows="3" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} className="w-full resize-none rounded-2xl border border-white/10 bg-ink/60 p-3.5 text-sm text-white outline-none focus:border-electric/70" placeholder="Inspection notes or work progress" /></Field></div>
      <div className="grid gap-3"><div className="flex items-center justify-between"><div><h3 className="font-bold text-white">Work items</h3><p className="text-xs text-slate-500">Assigned staff can update these items.</p></div><Button type="button" variant="secondary" className="min-h-9" onClick={() => setForm((current) => ({ ...current, job_items: [...current.job_items, { description: '', is_done: false }] }))}><Plus size={15} /> Add item</Button></div>{form.job_items.map((item, index) => <div key={index} className="flex gap-2"><button type="button" aria-label="Mark complete" onClick={() => setItem(index, 'is_done', !item.is_done)} className={`mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.is_done ? 'bg-lime/15 text-lime' : 'bg-white/5 text-slate-500'}`}>{item.is_done ? <CheckCircle2 size={18} /> : <Check size={18} />}</button><Input value={item.description} onChange={(e) => setItem(index, 'description', e.target.value)} placeholder="Example: Change engine oil" /><button type="button" aria-label="Remove item" onClick={() => setForm((current) => ({ ...current, job_items: current.job_items.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-xl px-2 text-slate-500 hover:text-red-200"><Trash2 size={16} /></button></div>)}</div>
      {canEditAll && <div className="grid gap-3"><div className="flex items-center justify-between"><div><h3 className="font-bold text-white">Parts</h3><p className="text-xs text-slate-500">Parts used or required.</p></div><Button type="button" variant="secondary" className="min-h-9" onClick={() => setForm((current) => ({ ...current, job_parts: [...current.job_parts, { name: '', qty: 1 }] }))}><Plus size={15} /> Add part</Button></div>{form.job_parts.map((part, index) => <div key={index} className="grid grid-cols-[1fr_5rem_auto] gap-2"><Input value={part.name} onChange={(e) => setPart(index, 'name', e.target.value)} placeholder="Part name" /><Input type="number" min="1" value={part.qty} onChange={(e) => setPart(index, 'qty', Number(e.target.value))} /><button type="button" aria-label="Remove part" onClick={() => setForm((current) => ({ ...current, job_parts: current.job_parts.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-xl px-2 text-slate-500 hover:text-red-200"><Trash2 size={16} /></button></div>)}</div>}
      <div className="flex gap-2 border-t border-white/10 pt-5"><Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit" className="flex-1"><Check size={16} /> {saving ? 'Saving…' : 'Save job card'}</Button></div>
    </form>
  </Card></div></div>
}

function PhotoGrid({ job, canEdit, onUpload, onDelete }) {
  const [busy, setBusy] = useState(false)
  async function choose(event) {
    const files = [...event.target.files]
    if (!files.length) return
    setBusy(true); await onUpload(job.id, files); setBusy(false); event.target.value = ''
  }
  return <div className="grid gap-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-white">Work photos</h3><p className="text-xs text-slate-500">Automatically compressed to 1600px before upload.</p></div>{canEdit && <div className="flex gap-2"><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-200 hover:bg-white/10"><Camera size={15} /> Camera<input hidden type="file" accept="image/*" capture="environment" onChange={choose} /></label><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-200 hover:bg-white/10"><ImagePlus size={15} /> Gallery<input hidden multiple type="file" accept="image/*" onChange={choose} /></label></div>}</div>{busy && <div className="rounded-xl bg-electric/10 px-3 py-2 text-xs text-electric">Compressing and uploading images…</div>}<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(job.job_photos || []).map((photo) => <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-white/5"><a href={photo.signed_url || '#'} target="_blank" rel="noreferrer"><img src={photo.signed_url} alt={photo.caption || 'Job card image'} className="h-full w-full object-cover transition group-hover:scale-105" /></a>{(canEdit && (photo.uploaded_by === canEdit.userId || canEdit.isAdmin)) && <button onClick={() => onDelete(photo)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-xl bg-black/70 text-red-200"><Trash2 size={14} /></button>}</div>)}{!(job.job_photos || []).length && <div className="col-span-full rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-slate-500">No images for this job card yet.</div>}</div></div>
}

function JobDetail({ job, jobs, users, user, onClose, onEdit, onUpload, onDelete }) {
  const others = jobs.filter((item) => item.id !== job.id && normalizePlateNo(item.plate_no) === normalizePlateNo(job.plate_no)).sort((a, b) => String(b.check_in_date).localeCompare(String(a.check_in_date)))
  const canEdit = user.role === 'admin' || job.assigned_staff === user.id
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 sm:p-6"><div className="mx-auto max-w-5xl"><Card className="my-2 sm:my-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(job.status)}>{statusLabel(job.status)}</Badge><span className="text-xs text-slate-500">{job.check_in_date}</span></div><h2 className="mt-3 text-3xl font-black text-white">{normalizePlateNo(job.plate_no)}</h2><p className="mt-1 text-sm text-slate-400">{job.vehicles?.car_model || job.car_model || 'Model not provided'} · {staffName(users, job.assigned_staff)}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={() => onClose()}><X size={16} /> Close</Button>{canEdit && <Button onClick={() => onEdit(job)}><Pencil size={16} /> Edit</Button>}</div></div>
    <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><div className="grid gap-4"><Card className="bg-white/[.03]"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer complaint</div><p className="mt-2 text-sm leading-relaxed text-slate-200">{job.customer_complaint}</p></Card><Card className="bg-white/[.03]"><h3 className="font-bold text-white">Work items</h3><div className="mt-3 grid gap-2">{(job.job_items || []).map((item) => <div key={item.id || item.description} className="flex items-center gap-3 rounded-xl bg-white/[.03] p-3 text-sm"><CheckCircle2 size={17} className={item.is_done ? 'text-lime' : 'text-slate-600'} /><span className={item.is_done ? 'text-slate-300 line-through' : 'text-white'}>{item.description}</span></div>)}{!(job.job_items || []).length && <p className="text-sm text-slate-500">No work items yet.</p>}</div></Card><Card className="bg-white/[.03]"><h3 className="font-bold text-white">Parts</h3><div className="mt-3 grid gap-2">{(job.job_parts || []).map((part) => <div key={part.id || part.name} className="flex justify-between rounded-xl bg-white/[.03] p-3 text-sm"><span className="text-slate-200">{part.name}</span><span className="text-slate-500">× {part.qty}</span></div>)}{!(job.job_parts || []).length && <p className="text-sm text-slate-500">No parts yet.</p>}</div></Card></div><div className="grid content-start gap-4"><Card className="bg-white/[.03]"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Mechanic notes</div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{job.notes || 'No notes.'}</p></Card><Card className="bg-white/[.03]"><h3 className="font-bold text-white">Status history</h3><div className="mt-3 grid gap-2">{(job.job_status_history || []).map((item) => <div key={item.id} className="flex items-start gap-3 text-sm"><div className="mt-1 h-2 w-2 rounded-full bg-electric" /><div><div className="text-slate-200">{item.old_status ? `${statusLabel(item.old_status)} → ` : ''}{statusLabel(item.new_status)}</div><div className="text-xs text-slate-500">{item.changed_at ? new Intl.DateTimeFormat('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.changed_at)) : '—'} · {staffName(users, item.changed_by)}</div></div></div>)}{!(job.job_status_history || []).length && <p className="text-sm text-slate-500">No status history yet.</p>}</div></Card></div></div>
    <div className="mt-5"><PhotoGrid job={job} canEdit={canEdit ? { userId: user.id, isAdmin: user.role === 'admin' } : false} onUpload={onUpload} onDelete={onDelete} /></div>
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center gap-2"><History size={17} className="text-electric" /><h3 className="font-bold text-white">Vehicle history</h3></div><div className="mt-3 grid gap-2">{others.map((item) => <button key={item.id} onClick={() => onClose(item.id)} className="flex items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5"><div className="flex-1"><div className="text-sm font-semibold text-white">{item.check_in_date} · {item.customer_complaint}</div><div className="mt-1 text-xs text-slate-500">{staffName(users, item.assigned_staff)}</div></div><Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge><ChevronRight size={16} className="text-slate-500" /></button>)}{!others.length && <p className="text-sm text-slate-500">No other visits recorded.</p>}</div></div>
  </Card></div></div>
}

export default function JobCardsPage({ user, users, jobs, vehicles, isHistoryPage = false, onSave, onUpload, onDeletePhoto }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [staff, setStaff] = useState('All')
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const query = normalizePlateNo(search)
  const filtered = useMemo(() => jobs.filter((job) => (isHistoryPage || job.status !== 'Collected') && (!query || normalizePlateNo(job.plate_no).includes(query)) && (!isHistoryPage || query) && (status === 'All' || job.status === status) && (staff === 'All' || job.assigned_staff === staff)).sort((a, b) => String(b.check_in_date).localeCompare(String(a.check_in_date))), [jobs, query, isHistoryPage, status, staff])
  const vehicleSummaries = useMemo(() => [...new Set(filtered.map((job) => normalizePlateNo(job.plate_no)))].map((plate) => { const rows = filtered.filter((job) => normalizePlateNo(job.plate_no) === plate); return { plate, model: rows[0]?.vehicles?.car_model || 'Model not provided', rows } }), [filtered])
  function openDetail(job) { setSelected(job.id) }
  const selectedJob = jobs.find((job) => job.id === selected)
  function closeDetail(nextId) { setSelected(nextId || null) }
  return <div className="grid gap-5"><Card><div className="flex flex-wrap items-start justify-between gap-4"><div><Badge tone="blue">{isHistoryPage ? 'Vehicle records' : 'Workshop operations'}</Badge><h2 className="mt-3 text-2xl font-black text-white">{isHistoryPage ? 'Vehicle History' : 'Job Cards'}</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">{isHistoryPage ? 'Search a registration number to view all visits, summaries, and full job cards.' : 'Record work, status, parts, photos, and history for every vehicle.'}</p></div>{!isHistoryPage && user.role === 'admin' && <Button onClick={() => setEditing(newJobCardDraft(users.find((person) => person.role === 'staff')?.id || ''))}><Plus size={16} /> New job card</Button>}</div><div className="mt-5 grid gap-3 lg:grid-cols-[1fr_11rem_13rem]"><div className="relative"><Search className="absolute left-3 top-3.5 text-slate-500" size={17} /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" placeholder={isHistoryPage ? 'Search registration no., e.g. JRX' : 'Search registration no.'} /></div>{!isHistoryPage && <><Select value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option>{JOB_STATUSES.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</Select><Select value={staff} onChange={(e) => setStaff(e.target.value)}><option value="All">All staff</option>{users.filter((person) => person.role === 'staff').map((person) => <option key={person.id} value={person.id}>{person.nickname}</option>)}</Select></>}</div>{isHistoryPage && !query && <div className="mt-4 rounded-2xl border border-electric/20 bg-electric/10 p-3 text-sm text-electric">Type at least part of a registration number to start searching.</div>}</Card>
    {isHistoryPage ? <div className="grid gap-4">{vehicleSummaries.map((vehicleRow) => <Card key={vehicleRow.plate}><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-electric/15 text-electric"><CarFront size={21} /></div><div><h3 className="text-xl font-black text-white">{vehicleRow.plate}</h3><p className="text-sm text-slate-400">{vehicleRow.model}</p></div></div><div className="text-right text-xs text-slate-500"><div><b className="text-white">{vehicleRow.rows.length}</b> visits</div><div>{vehicleRow.rows[vehicleRow.rows.length - 1]?.check_in_date} — {vehicleRow.rows[0]?.check_in_date}</div></div></div><div className="mt-4 grid gap-2">{vehicleRow.rows.map((job) => <button key={job.id} onClick={() => openDetail(job)} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 p-3 text-left hover:bg-white/5"><div className="min-w-24 text-xs text-slate-400">{job.check_in_date}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{job.customer_complaint}</div><div className="mt-1 truncate text-xs text-slate-500">{(job.job_items || []).filter((item) => item.description).slice(0, 3).map((item) => item.description).join(' · ') || 'No work items yet'}</div></div><span className="text-xs text-slate-500">{staffName(users, job.assigned_staff)}</span><Badge tone={statusTone(job.status)}>{statusLabel(job.status)}</Badge><ChevronRight size={16} className="text-slate-500" /></button>)}</div></Card>)}{query && !vehicleSummaries.length && <Card><div className="py-8 text-center text-sm text-slate-500">No history for that registration number.</div></Card>}</div> : <Card><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-white">Job card list</h3><p className="mt-1 text-xs text-slate-500">{filtered.length} records · Staff can view the full history.</p></div><ClipboardList className="text-electric" size={20} /></div><div className="grid gap-2">{filtered.map((job) => <button key={job.id} onClick={() => openDetail(job)} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 p-4 text-left hover:border-electric/40 hover:bg-white/[.03]"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-slate-300"><CarFront size={18} /></div><div className="min-w-32"><div className="font-black text-white">{normalizePlateNo(job.plate_no)}</div><div className="text-xs text-slate-500">{job.vehicles?.car_model || 'Model not provided'}</div></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-200">{job.customer_complaint}</div><div className="mt-1 truncate text-xs text-slate-500">{job.check_in_date} · {staffName(users, job.assigned_staff)} · {(job.job_items || []).filter((item) => item.description).length} work items</div></div><Badge tone={statusTone(job.status)}>{statusLabel(job.status)}</Badge><ChevronRight size={17} className="text-slate-500" /></button>)}{!filtered.length && <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center"><ClipboardList className="mx-auto mb-3 text-slate-600" size={28} /><div className="font-semibold text-slate-300">No job cards</div><div className="mt-1 text-sm text-slate-500">Try changing your search or filter.</div></div>}</div></Card>}
    {editing && <JobEditor job={editing.id ? jobs.find((item) => item.id === editing.id) : editing} vehicles={vehicles} users={users} canEditAll={user.role === 'admin'} onClose={() => setEditing(null)} onSave={onSave} />}
    {selectedJob && <JobDetail job={selectedJob} jobs={jobs} users={users} user={user} onClose={closeDetail} onEdit={(job) => { setSelected(null); setEditing(job) }} onUpload={onUpload} onDelete={onDeletePhoto} />}
  </div>
}











