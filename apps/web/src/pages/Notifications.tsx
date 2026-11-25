import { useState } from 'react';
import { Bell, BookOpen, CalendarDays, CheckCheck, CreditCard, MessageCircle, Settings2, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, PageHeader, SectionTitle, useToast } from '../components/ui';
import { relative } from '../lib/utils';

const icons: Record<string, any> = { class: CalendarDays, homework: BookOpen, fee: CreditCard, attendance: TrendingUp, material: BookOpen, chat: MessageCircle };

export default function Notifications() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any[]>('/notifications');
  const { data: prefs, setData: setPrefs } = useApi<Record<string, boolean>>('/notifications/prefs');
  const [showPrefs, setShowPrefs] = useState(false);

  const markAll = async () => { try { await api.post('/notifications/read', {}); toast('All marked as read.'); reload(); } catch (e: any) { toast(e.message, 'error'); } };
  const markOne = async (id: number) => { try { await api.post('/notifications/read', { id }); reload(); } catch { /* non-critical */ } };
  const toggle = async (cat: string, value: boolean) => {
    const next = { ...(prefs || {}), [cat]: value };
    setPrefs(next);
    try { await api.put('/notifications/prefs', { prefs: { [cat]: value } }); toast('Preference saved.'); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  if (error) return <ErrorBox error={error} retry={reload} />;
  return <>
    <PageHeader title="Notifications" subtitle="Classes, homework, fees, attendance and chat updates." action={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setShowPrefs(!showPrefs)}><Settings2 size={15} /> Preferences</Button><Button size="sm" onClick={markAll}><CheckCheck size={15} /> Mark all read</Button></div>} />
    {showPrefs && <Card className="mb-5"><SectionTitle title="Notification categories" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(prefs || {}).map(([cat, enabled]) => <label key={cat} className="flex items-center justify-between rounded-xl border border-ink-100 p-3 text-sm capitalize dark:border-slate-800"><span>{cat}</span><input type="checkbox" checked={!!enabled} onChange={(e) => toggle(cat, e.target.checked)} className="h-5 w-5 accent-[#1f6f5c]" /></label>)}</div></Card>}
    {loading && !data ? <Card><div className="h-64 animate-pulse rounded bg-slate-200/60" /></Card>
      : !data?.length ? <EmptyState icon={Bell} title="All quiet" description="Your notifications will appear here." />
      : <div className="space-y-2">{data.map((n) => { const Icon = icons[n.category] || Bell; return <button key={n.id} onClick={() => markOne(n.id)} className={`flex w-full items-start gap-3 rounded-xl2 border p-4 text-left transition dark:border-slate-800 ${n.read_at ? 'border-ink-100 bg-white dark:bg-slate-900' : 'border-brand-200 bg-brand-50/60 dark:border-brand-800 dark:bg-brand-900/20'}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 dark:bg-slate-800"><Icon size={18} /></span>
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{n.title}</span><Badge tone="slate">{n.category}</Badge></span><span className="mt-1 block text-xs text-ink-500 dark:text-slate-400">{n.body}</span><span className="mt-1 block text-[10px] text-ink-500">{relative(n.created_at)}</span></span>
        {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
      </button>; })}</div>}
  </>;
}
