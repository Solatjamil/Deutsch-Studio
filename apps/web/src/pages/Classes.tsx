import { useMemo, useState } from 'react';
import { BellRing, CalendarDays, Clock, ExternalLink, List, Plus, Video } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { enableReminders } from '../lib/notifications';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, SectionTitle, Textarea, useToast } from '../components/ui';
import { fmtDate, fmtTime } from '../lib/utils';

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default function Classes() {
  const { user, isStaff } = useAuth();
  const toast = useToast();
  const [view, setView] = useState<'week' | 'list'>('week');
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d; });
  const from = isoDay(addDays(weekStart, -7));
  const to = isoDay(addDays(weekStart, 21));
  const { data, loading, error, reload } = useApi<any[]>(`/schedule?from=${from}&to=${to}`, [from, to]);
  const { data: batches } = useApi<any[]>('/batches');
  const [selected, setSelected] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ date: isoDay(new Date()), reason: '' });
  const [newSession, setNewSession] = useState({ batchId: '', title: '', date: isoDay(new Date()), time: '09:00', duration: 60, agenda: '' });
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const sessions = data || [];
  const byDay = (day: Date) => sessions.filter((s) => isoDay(new Date(s.starts_at)) === isoDay(day)).sort((a: any, b: any) => a.starts_at.localeCompare(b.starts_at));

  const join = async (s: any) => {
    if (isStaff || user?.role === 'parent') { window.open(s.meeting_url, '_blank', 'noopener,noreferrer'); return; }
    try { const res = await api.post(`/sessions/${s.id}/join`); toast('Attendance marked. Opening class…'); window.open(res.meetingUrl, '_blank', 'noopener,noreferrer'); reload(); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const remind = async () => {
    const result = await enableReminders();
    toast(result === 'granted' ? 'Class reminders enabled.' : 'Browser notifications are not enabled.', result === 'granted' ? 'success' : 'error');
  };
  const create = async () => {
    setBusy(true);
    try {
      const start = new Date(`${newSession.date}T${newSession.time}:00`);
      await api.post('/sessions', { batchId: Number(newSession.batchId), title: newSession.title, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + newSession.duration * 60000).toISOString(), agenda: newSession.agenda });
      toast('Class scheduled.'); setCreating(false); reload();
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const requestLeave = async () => {
    setBusy(true);
    try { await api.post('/leave-requests', leaveForm); toast('Leave request submitted.'); setLeaveOpen(false); }
    catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  if (error) return <ErrorBox error={error} retry={reload} />;
  return <>
    <PageHeader title="Classes & schedule" subtitle="Your timetable, live rooms and recordings." action={<div className="flex gap-2">
      {user?.role === 'student' && <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>Request leave</Button>}
      <Button variant="outline" size="sm" onClick={remind}><BellRing size={15} /> Reminders</Button>
      {isStaff && <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} /> Schedule class</Button>}
    </div>} />
    <Card className="mb-5 !p-3"><div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>←</Button><span className="text-xs font-bold sm:text-sm">{fmtDate(isoDay(days[0]), { day: 'numeric', month: 'short' })} – {fmtDate(isoDay(days[6]), { day: 'numeric', month: 'short', year: 'numeric' })}</span><Button variant="ghost" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>→</Button></div>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"><button onClick={() => setView('week')} className={`rounded-md p-1.5 ${view === 'week' ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900' : 'text-ink-500'}`} aria-label="Week view"><CalendarDays size={16} /></button><button onClick={() => setView('list')} className={`rounded-md p-1.5 ${view === 'list' ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900' : 'text-ink-500'}`} aria-label="List view"><List size={16} /></button></div>
    </div></Card>

    {loading && !data ? <Card><div className="h-64 animate-pulse rounded-xl bg-slate-200/60" /></Card>
      : sessions.length === 0 ? <EmptyState icon={CalendarDays} title="No classes in this range" description="Try another week or check back later." action={<Button size="sm" onClick={() => setWeekStart(new Date())}>This week</Button>} />
      : view === 'week' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">{days.map((day) => <div key={isoDay(day)} className="rounded-xl2 border border-ink-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 text-center"><p className="text-[10px] font-bold uppercase text-ink-500">{day.toLocaleDateString('en-GB', { weekday: 'short' })}</p><p className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold ${isoDay(day) === isoDay(new Date()) ? 'bg-brand-600 text-white' : ''}`}>{day.getDate()}</p></div>
        <div className="space-y-2">{byDay(day).map((s: any) => <button key={s.id} onClick={() => setSelected(s)} className="w-full rounded-lg border-l-2 border-brand-500 bg-brand-50 p-2 text-left dark:bg-brand-900/30"><p className="text-[10px] font-bold text-brand-700 dark:text-brand-200">{fmtTime(s.starts_at)}</p><p className="line-clamp-2 text-[11px] font-semibold">{s.title}</p><p className="truncate text-[9px] text-ink-500">{s.batch_name}</p>{s.is_live === 1 && <Badge tone="red" className="mt-1 !px-1.5 !py-0.5 !text-[8px]">LIVE</Badge>}</button>)}
          {!byDay(day).length && <p className="py-3 text-center text-[10px] text-slate-400">—</p>}</div>
      </div>)}</div>
        : <Card><SectionTitle title={`${sessions.length} sessions`} /><div className="space-y-2">{sessions.map((s: any) => <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 p-3 dark:border-slate-800"><div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30"><Video size={19} /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold">{s.title}</p><p className="text-xs text-ink-500">{s.batch_name} · {fmtDate(s.starts_at)} · {fmtTime(s.starts_at)}–{fmtTime(s.ends_at)}</p></div>{s.is_live === 1 && <Badge tone="red">Live now</Badge>}<Button size="sm" onClick={() => join(s)}><ExternalLink size={14} /> Join</Button></div>)}</div></Card>}

    <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title || 'Class details'}>
      {selected && <div className="space-y-4"><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-ink-50 p-3 dark:bg-slate-800"><p className="text-[10px] text-ink-500">Date</p><p className="font-bold">{fmtDate(selected.starts_at)}</p></div><div className="rounded-xl bg-ink-50 p-3 dark:bg-slate-800"><p className="text-[10px] text-ink-500">Time</p><p className="font-bold">{fmtTime(selected.starts_at)} – {fmtTime(selected.ends_at)}</p></div></div>
        <p className="text-sm text-ink-500 dark:text-slate-400">{selected.agenda || 'No agenda added for this session.'}</p>
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-xs dark:bg-brand-900/30"><Clock size={15} className="text-brand-600" /> Attendance is marked automatically when you join as a student.</div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setSelected(null)}>Close</Button><Button onClick={() => { join(selected); setSelected(null); }}><Video size={15} /> Join class</Button></div>
      </div>}
    </Modal>

    <Modal open={creating} onClose={() => setCreating(false)} title="Schedule a live class">
      <div className="space-y-3"><Field label="Batch"><select value={newSession.batchId} onChange={(e) => setNewSession({ ...newSession, batchId: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Choose a batch</option>{(batches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Title"><Input value={newSession.title} onChange={(e) => setNewSession({ ...newSession, title: e.target.value })} placeholder="e.g. Speaking practice" /></Field>
        <div className="grid grid-cols-3 gap-3"><Field label="Date"><Input type="date" value={newSession.date} onChange={(e) => setNewSession({ ...newSession, date: e.target.value })} /></Field><Field label="Time"><Input type="time" value={newSession.time} onChange={(e) => setNewSession({ ...newSession, time: e.target.value })} /></Field><Field label="Minutes"><Input type="number" min={15} value={newSession.duration} onChange={(e) => setNewSession({ ...newSession, duration: Number(e.target.value) })} /></Field></div>
        <Field label="Agenda"><Textarea value={newSession.agenda} onChange={(e) => setNewSession({ ...newSession, agenda: e.target.value })} placeholder="What will you cover?" /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={create} disabled={busy || !newSession.batchId || !newSession.title}>Schedule</Button></div>
      </div>
    </Modal>

    <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Request leave">
      <div className="space-y-3"><Field label="Date"><Input type="date" value={leaveForm.date} onChange={(e) => setLeaveForm({ ...leaveForm, date: e.target.value })} /></Field><Field label="Reason"><Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Tell your tutor why you cannot attend" /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setLeaveOpen(false)}>Cancel</Button><Button onClick={requestLeave} disabled={busy || leaveForm.reason.length < 4}>Submit request</Button></div></div>
    </Modal>
  </>;
}
