import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock, IndianRupee, Search, Sparkles, UsersRound } from 'lucide-react';
import { api } from '../lib/api';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Progress, useToast } from '../components/ui';
import { money } from '../lib/utils';

export default function Courses() {
  const { data, loading, error, reload } = useApi<any[]>('/courses');
  const { data: allBatches } = useApi<any[]>('/batches');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [batchId, setBatchId] = useState<number | undefined>();
  const [discount, setDiscount] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const courses = useMemo(() => (data || []).filter((c) => {
    const q = query.toLowerCase();
    return (!q || c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) && (level === 'all' || c.level === level || c.level?.includes(level));
  }), [data, query, level]);

  const enroll = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await api.post(`/courses/${selected.id}/enroll`, { batchId, discountCode: discount || undefined });
      toast(res.invoice ? 'Enrolled! An invoice was added to your fee ledger.' : 'Enrolled successfully!');
      setSelected(null); reload();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  if (error) return <ErrorBox error={error} retry={reload} />;
  return <>
    <PageHeader title="Courses & batches" subtitle="Find your next step in German — from first words to exam readiness." />
    <Card className="mb-5 !p-4"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses and topics" className="pl-9" aria-label="Search courses" /></div><select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filter by level" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="all">All levels</option>{['A1', 'A2', 'B1', 'B2', 'C1'].map((l) => <option key={l} value={l}>{l}</option>)}<option value="B2">Exam prep</option></select></div></Card>
    {loading && !data ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <Card key={i}><div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" /><div className="mt-4 h-20 animate-pulse rounded bg-slate-200" /></Card>)}</div>
      : courses.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{courses.map((c) => <Card key={c.id} className="flex flex-col">
        <div className="mb-4 flex items-start justify-between gap-2"><span className="rounded-xl px-3 py-1.5 text-xs font-extrabold text-white" style={{ background: c.accent || '#1f6f5c' }}>{c.code}</span><Badge tone={c.enrolled ? 'green' : 'slate'}>{c.enrolled ? 'Enrolled' : `${c.duration_weeks} weeks`}</Badge></div>
        <h2 className="text-base font-extrabold">{c.title}</h2><p className="mt-2 line-clamp-3 flex-1 text-sm text-ink-500 dark:text-slate-400">{c.description}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-ink-500 dark:text-slate-400"><span className="inline-flex items-center gap-1"><BookOpen size={13} /> {c.modules} modules · {c.lessons} lessons</span><span className="inline-flex items-center gap-1"><Clock size={13} /> {c.schedule_text}</span></div>
        <p className="mt-3 text-xs font-medium text-ink-500 dark:text-slate-400">Tutor: {c.tutor_name || 'Deutsch Studio'}</p>
        {c.enrolled > 0 && <div className="mt-3"><Progress value={c.progress_pct || 0} /><p className="mt-1 text-[10px] text-ink-500">Your progress {c.progress_pct || 0}%</p></div>}
        <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4 dark:border-slate-800"><div><p className="text-[10px] text-ink-500">Course fee</p><p className="text-lg font-extrabold text-brand-700 dark:text-brand-300">{money(c.price)}</p></div>
          {c.enrolled ? <Link to={`/app/courses/${c.id}`}><Button size="sm" variant="secondary">Continue <ArrowRight size={14} /></Button></Link> : <Button size="sm" onClick={() => { setSelected(c); setBatchId(undefined); setDiscount(''); }}>Enroll <ArrowRight size={14} /></Button>}
        </div>
      </Card>)}</div> : <EmptyState icon={Sparkles} title="No courses matched" description="Try a different search or level filter." />}

    <Modal open={!!selected} onClose={() => setSelected(null)} title={`Enroll in ${selected?.title || ''}`}>
      {selected && <div className="space-y-4">
        <div className="rounded-xl bg-brand-50 p-4 dark:bg-brand-900/30"><p className="text-xs text-brand-700 dark:text-brand-200">Course fee</p><p className="text-2xl font-extrabold text-brand-800 dark:text-white">{money(selected.price)}</p><p className="mt-1 text-xs text-ink-500">Includes live classes, recordings, homework feedback and study material.</p></div>
        <Field label="Choose a batch"><select value={batchId || ''} onChange={(e) => setBatchId(e.target.value ? Number(e.target.value) : undefined)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Auto-assign the next open batch</option>{(allBatches || []).filter((b) => b.course_id === selected.id).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Discount code" hint="Try WELCOME10 for PKR 1,000 off."><Input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Optional code" /></Field>
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"><IndianRupee size={15} className="mt-0.5 shrink-0" /> Payment uses a clearly marked sandbox gateway in this demo. No card details are collected or stored.</div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={enroll} disabled={busy}>{busy ? 'Processing…' : 'Confirm enrollment'}</Button></div>
      </div>}
    </Modal>
  </>;
}
