import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, Award, CheckCircle2, ClipboardCheck, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, useToast } from '../components/ui';
import { fmtDate, fmtDateTime } from '../lib/utils';

export default function Tests() {
  const { isStaff } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any[]>('/tests');
  const { data: batches } = useApi<any[]>('/batches');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ batchId: '', title: '', durationMin: 20, scheduledAt: new Date().toISOString().slice(0, 10), questions: [{ prompt: '', options: ['', '', '', ''], answer: '' }] });

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/tests', { batchId: Number(form.batchId), title: form.title, durationMin: form.durationMin,
        scheduledAt: new Date(`${form.scheduledAt}T10:00:00`).toISOString(),
        questions: form.questions.filter((q) => q.prompt && q.answer).map((q) => ({ prompt: q.prompt, options: q.options.filter(Boolean), answer: q.answer, marks: 2 })) });
      toast('Test published.'); setCreating(false); reload();
    } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  if (error) return <ErrorBox error={error} retry={reload} />;
  return <>
    <PageHeader title="Tests & mock exams" subtitle={isStaff ? 'Publish timed assessments and auto-grade MCQs.' : 'Check your understanding with short tests and mocks.'} action={isStaff ? <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} /> New test</Button> : undefined} />
    {loading && !data ? <Card><div className="h-48 animate-pulse rounded bg-slate-200/60" /></Card>
      : !data?.length ? <EmptyState icon={ClipboardCheck} title="No tests scheduled" description={isStaff ? 'Create your first test for a batch.' : 'Your tutor has not published a test yet.'} />
      : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.map((t) => <Card key={t.id} className="flex flex-col"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10"><Award size={19} /></span><Badge>{t.status}</Badge></div><h2 className="mt-3 text-sm font-extrabold">{t.title}</h2><p className="mt-1 text-xs text-ink-500">{t.batch_name}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink-500"><span className="inline-flex items-center gap-1"><AlarmClock size={13} /> {t.duration_min} min</span><span>{fmtDate(t.scheduled_at)}</span></div>
        <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 dark:border-slate-800">{t.score !== undefined ? <div><p className="text-[10px] text-ink-500">Your score</p><p className="text-lg font-extrabold text-brand-700 dark:text-brand-300">{t.score}/{t.max_score || 10}</p></div> : <div><p className="text-[10px] text-ink-500">{t.attempts !== undefined ? `${t.attempts} attempts` : 'Not attempted'}</p><p className="text-xs font-bold">{fmtDateTime(t.scheduled_at)}</p></div>}
          <Link to={`/app/tests/${t.id}`}><Button size="sm">{t.score !== undefined ? 'Review' : 'Open'}</Button></Link></div>
      </Card>)}</div>}
    <Modal open={creating} onClose={() => setCreating(false)} title="Create a test" wide>
      <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Field label="Batch"><select value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Choose batch</option>{(batches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. A1 Unit Test 2" /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Duration (min)"><Input type="number" min={5} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} /></Field><Field label="Scheduled date"><Input type="date" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field></div>
        <div><p className="mb-2 text-xs font-semibold">Questions</p>{form.questions.map((q, qi) => <div key={qi} className="mb-3 rounded-xl border border-ink-100 p-3 dark:border-slate-800"><Input value={q.prompt} onChange={(e) => { const qs = [...form.questions]; qs[qi].prompt = e.target.value; setForm({ ...form, questions: qs }); }} placeholder="Question prompt" />
          <div className="mt-2 grid grid-cols-2 gap-2">{q.options.map((o, oi) => <Input key={oi} value={o} onChange={(e) => { const qs = [...form.questions]; qs[qi].options[oi] = e.target.value; setForm({ ...form, questions: qs }); }} placeholder={`Option ${oi + 1}`} />)}</div>
          <Input className="mt-2" value={q.answer} onChange={(e) => { const qs = [...form.questions]; qs[qi].answer = e.target.value; setForm({ ...form, questions: qs }); }} placeholder="Correct answer (must match an option)" /></div>)}
          <Button variant="outline" size="sm" onClick={() => setForm({ ...form, questions: [...form.questions, { prompt: '', options: ['', '', '', ''], answer: '' }] })}>+ Add question</Button></div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={create} disabled={busy || !form.batchId || !form.title}>Publish test</Button></div>
      </div>
    </Modal>
  </>;
}
