import { useState } from 'react';
import { Megaphone, Plus, UsersRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Textarea, useToast } from '../components/ui';
import { relative } from '../lib/utils';

export default function Announcements() {
  const { isStaff } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any[]>('/announcements');
  const { data: batches } = useApi<any[]>('/batches');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', batchId: '' });

  const create = async () => {
    try { await api.post('/announcements', { title: form.title, body: form.body, batchId: form.batchId ? Number(form.batchId) : null }); toast('Announcement posted.'); setCreating(false); setForm({ title: '', body: '', batchId: '' }); reload(); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const markRead = async (id: number) => { try { await api.post(`/announcements/${id}/read`); reload(); } catch { /* non-critical */ } };

  if (error) return <ErrorBox error={error} retry={reload} />;
  return <>
    <PageHeader title="Announcements" subtitle="Important updates from your studio." action={isStaff ? <Button size="sm" onClick={() => setCreating(true)}><Plus size={15} /> New post</Button> : undefined} />
    {loading && !data ? <Card><div className="h-48 animate-pulse rounded bg-slate-200/60" /></Card>
      : !data?.length ? <EmptyState icon={Megaphone} title="No announcements" description="Posts from your tutors will appear here." />
      : <div className="space-y-3">{data.map((a) => <Card key={a.id} className={!a.readByMe ? 'border-l-4 border-l-brand-500' : ''}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={a.batch_id ? 'blue' : 'green'}>{a.batch_id ? 'Batch update' : 'Institute-wide'}</Badge>{!a.readByMe && <Badge tone="amber">New</Badge>}</div><h2 className="mt-2 text-base font-extrabold">{a.title}</h2></div><span className="text-[11px] text-ink-500">{relative(a.created_at)}</span></div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-500 dark:text-slate-300">{a.body}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3 text-[11px] text-ink-500 dark:border-slate-800"><span className="inline-flex items-center gap-1"><UsersRound size={13} /> {isStaff ? `${a.reads} of ${a.recipients || '—'} read` : `${a.reads} read`}</span>{!a.readByMe && <Button size="sm" variant="outline" onClick={() => markRead(a.id)}>Mark as read</Button>}</div>
      </Card>)}</div>}
    <Modal open={creating} onClose={() => setCreating(false)} title="Post an announcement"><div className="space-y-3"><Field label="Audience"><select value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Everyone in the institute</option>{(batches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What's the update?" /></Field><Field label="Message"><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the announcement…" /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={create} disabled={!form.title || !form.body}>Post</Button></div></div></Modal>
  </>;
}
