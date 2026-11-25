import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, Plus, Star } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, SectionTitle, Textarea, useToast } from '../components/ui';
import { fmtDate, relative } from '../lib/utils';

export default function Homework() {
  const { isStaff } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<any[]>('/homework');
  const { data: batches } = useApi<any[]>('/batches');
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ batchId: '', title: '', instructions: '', dueAt: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), maxMarks: 10 });
  const list = (data || []).filter((h) => filter === 'all' || h.status === filter || (filter === 'review' && h.status === 'reviewed'));

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/homework', { batchId: Number(form.batchId), title: form.title, instructions: form.instructions, dueAt: new Date(`${form.dueAt}T23:59:00`).toISOString(), maxMarks: form.maxMarks });
      toast('Homework assigned to the batch.'); setCreating(false); reload();
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  if (error) return <ErrorBox error={error} retry={reload} />;
  return <>
    <PageHeader title="Homework & assignments" subtitle={isStaff ? 'Create work, track submissions and give feedback.' : 'Submit your work and see tutor feedback.'} action={isStaff ? <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} /> New homework</Button> : undefined} />
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{['all', 'pending', 'submitted', 'late', 'reviewed'].map((f) => <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold capitalize ${filter === f ? 'bg-brand-600 text-white' : 'bg-white text-ink-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'}`}>{f}</button>)}</div>
    {loading && !data ? <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <Card key={i}><div className="h-20 animate-pulse rounded bg-slate-200" /></Card>)}</div>
      : list.length ? <div className="grid gap-3 sm:grid-cols-2">
        {list.map((h) => <Link key={h.id} to={`/app/homework/${h.id}`} className="block"><Card className="h-full transition hover:-translate-y-0.5 hover:border-brand-300">
          <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">{h.batch_name}</p><h2 className="mt-1 text-sm font-extrabold">{h.title}</h2></div><Badge>{h.status || 'pending'}</Badge></div>
          <p className="mt-2 line-clip-2 line-clamp-2 text-xs text-ink-500 dark:text-slate-400">{h.instructions}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3 text-[11px] text-ink-500 dark:border-slate-800"><span className="inline-flex items-center gap-1"><CalendarDays size={13} /> Due {fmtDate(h.due_at, { day: 'numeric', month: 'short' })}</span>
            {isStaff ? <span>{h.submitted}/{h.pending + h.submitted} submitted</span> : <span className="inline-flex items-center gap-1"><Star size={13} /> Max {h.max_marks} marks{h.marks !== null && h.marks !== undefined ? ` · got ${h.marks}` : ''}</span>}
          </div>
        </Card></Link>)}
      </div> : <EmptyState icon={ClipboardCheck} title="No homework here" description={filter === 'all' ? 'New assignments will show up as soon as your tutor posts them.' : `Nothing with status “${filter}”.`} />}

    <Modal open={creating} onClose={() => setCreating(false)} title="Create homework">
      <div className="space-y-3"><Field label="Batch"><select value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Choose batch</option>{(batches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Describe your daily routine" /></Field>
        <Field label="Instructions"><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="What should students do?" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Due date"><Input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></Field><Field label="Max marks"><Input type="number" min={1} max={100} value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })} /></Field></div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={create} disabled={busy || !form.batchId || !form.title || !form.instructions}>Assign homework</Button></div>
      </div>
    </Modal>
  </>;
}
