import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bell, CheckCircle2, CreditCard, Download, ReceiptText, Send, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, SectionTitle, useToast } from '../components/ui';
import { fmtDate, money } from '../lib/utils';

export default function Fees() {
  const { isStaff, children } = useAuth();
  const toast = useToast();
  const [studentId, setStudentId] = useState<string>(children[0] ? String(children[0].id) : '');
  const [paying, setPaying] = useState<any>(null);
  const [cash, setCash] = useState<any>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useApi<any>(isStaff ? '/fees/collections' : `/fees/summary${studentId && studentId !== String(0) ? `?studentId=${studentId}` : ''}`, [studentId]);
  const { data: defaulters, reload: reloadDefaulters } = useApi<any[]>(isStaff ? '/fees/defaulters' : null, []);
  const { data: invoices, reload: reloadInvoices } = useApi<any[]>(isStaff ? '/fees/invoices' : null, []);

  const pay = async () => {
    if (!paying) return;
    setBusy(true);
    try { await api.post('/fees/pay', { invoiceId: paying.id, method: 'mock-gateway' }); toast('Payment successful (sandbox gateway).'); setPaying(null); reload(); reloadInvoices(); reloadDefaulters(); }
    catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const recordCash = async () => {
    if (!cash) return;
    setBusy(true);
    try { await api.post('/fees/cash', { invoiceId: cash.id, amount: Number(cashAmount) }); toast('Cash payment recorded.'); setCash(null); setCashAmount(''); reload(); reloadInvoices(); reloadDefaulters(); }
    catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const remind = async (ids: number[]) => {
    try { await api.post('/fees/reminders', { invoiceIds: ids }); toast(`Reminder sent for ${ids.length} invoice(s).`); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  if (error) return <ErrorBox error={error} retry={reload} />;
  if (isStaff) return <>
    <PageHeader title="Fees & collections" subtitle="Invoices, payments and defaulters at a glance." action={<Button size="sm" variant="outline" onClick={() => remind((defaulters || []).map((d) => d.id))} disabled={!defaulters?.length}><Bell size={15} /> Send all reminders</Button>} />
    {loading && !data ? <Card><div className="h-64 animate-pulse rounded bg-slate-200/60" /></Card> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Collected', money(data.collected), Wallet], ['Outstanding', money(data.outstanding), ReceiptText], ['Invoices', data.invoiceCount, CreditCard], ['Defaulters', defaulters?.length || 0, Bell]].map(([label, value, Icon]: any) => <Card key={String(label)} className="!p-4"><Icon size={18} className="text-brand-600" /><p className="mt-2 text-[11px] text-ink-500">{label}</p><p className="text-xl font-extrabold">{value}</p></Card>)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card><SectionTitle title="Collection trend" /><div className="h-64">{data.monthly?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="amount" fill="#1f6f5c" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState icon={ReceiptText} title="No payments yet" />}</div></Card>
        <Card><SectionTitle title="Defaulters" /><div className="max-h-72 space-y-2 overflow-y-auto">{defaulters?.map((d) => <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-100 p-3 dark:border-slate-800"><div className="min-w-24 flex-1"><p className="text-xs font-bold">{d.name}</p><p className="text-[10px] text-ink-500">{d.number} · due {fmtDate(d.due_at)}</p></div><span className="text-xs font-bold text-red-600">{money(d.total)}</span><Button size="sm" variant="outline" onClick={() => setCash(d)}>Cash</Button><Button size="sm" variant="ghost" onClick={() => remind([d.id])}><Send size={13} /></Button></div>)}{!defaulters?.length && <p className="text-sm text-ink-500">No pending dues — great work!</p>}</div></Card>
      </div>
      <Card className="mt-5"><SectionTitle title="All invoices" /><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-ink-500"><tr><th className="py-2">Invoice</th><th>Student</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>{invoices?.map((i) => <tr key={i.id} className="border-t border-ink-100 dark:border-slate-800"><td className="py-2 font-bold">{i.number}</td><td>{i.student_name}</td><td>{fmtDate(i.due_at)}</td><td>{money(i.total)}</td><td><Badge>{i.status}</Badge></td><td><button onClick={() => api.download(`/fees/invoice/${i.id}/pdf`, `${i.number}.pdf`).catch((e) => toast(e.message, 'error'))} className="text-brand-600"><Download size={14} /></button></td></tr>)}</tbody></table></div></Card>
    </>}
    <Modal open={!!cash} onClose={() => setCash(null)} title="Record cash payment"><div className="space-y-3"><p className="text-sm">{cash?.number} · {cash?.student_name} · Due {money(cash?.total)}</p><Field label="Amount received"><Input type="number" min={1} max={cash?.total} value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0" /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCash(null)}>Cancel</Button><Button onClick={recordCash} disabled={busy || !cashAmount}>Record payment</Button></div></div></Modal>
  </>;

  return <>
    <PageHeader title="Fees & payments" subtitle="Track dues, view receipts and pay securely." action={children.length > 1 ? <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">{children.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : undefined} />
    {loading && !data ? <Card><div className="h-64 animate-pulse rounded bg-slate-200/60" /></Card> : <>
      <Card className="mb-5 bg-gradient-to-br from-brand-600 to-brand-800 !text-white"><div className="flex flex-wrap items-center gap-4"><div className="flex-1"><p className="text-xs text-brand-100">Total due</p><p className="text-3xl font-extrabold">{money(data?.due)}</p><p className="mt-1 text-xs text-brand-100">{data?.invoices?.filter((i: any) => i.status !== 'paid').length || 0} unpaid invoice(s)</p></div><div className="text-right"><p className="text-xs text-brand-100">Paid so far</p><p className="text-xl font-extrabold">{money(data?.paid)}</p></div></div></Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><SectionTitle title="Invoices" /><div className="space-y-2">{data?.invoices?.map((i: any) => <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 p-3 dark:border-slate-800"><div className="min-w-24 flex-1"><p className="text-xs font-bold">{i.number}</p><p className="text-[10px] text-ink-500">{i.plan_name} · due {fmtDate(i.due_at)}</p></div><span className="text-sm font-extrabold">{money(i.total)}</span><Badge>{i.status}</Badge>
          <div className="flex gap-1">{i.status !== 'paid' && <Button size="sm" onClick={() => setPaying(i)}><CreditCard size={13} /> Pay</Button>}<button onClick={() => api.download(`/fees/invoice/${i.id}/pdf`, `${i.number}.pdf`).catch((e) => toast(e.message, 'error'))} aria-label="Download invoice" className="rounded-lg p-2 text-brand-600 hover:bg-brand-50"><Download size={16} /></button></div>
        </div>)}{!data?.invoices?.length && <EmptyState icon={ReceiptText} title="No invoices yet" />}</div></Card>
        <div className="space-y-5"><Card><SectionTitle title="Payment history" /><div className="space-y-2">{data?.payments?.map((p: any) => <div key={p.id} className="flex items-center justify-between rounded-xl bg-ink-50 p-3 text-xs dark:bg-slate-800"><div><p className="font-bold">{money(p.amount)}</p><p className="text-ink-500">{p.method} · {fmtDate(p.paid_at)}</p></div><CheckCircle2 size={16} className="text-emerald-500" /></div>)}{!data?.payments?.length && <p className="text-sm text-ink-500">No payments recorded yet.</p>}</div></Card>
          <Card><h2 className="text-sm font-extrabold">Payment options</h2><p className="mt-2 text-xs leading-relaxed text-ink-500 dark:text-slate-400">This demo uses a sandbox payment abstraction. A production build can plug in Razorpay or Stripe without changing the UI. Card details are never stored on our servers.</p></Card></div>
      </div>
    </>}
    <Modal open={!!paying} onClose={() => setPaying(null)} title="Pay invoice"><div className="space-y-4"><div className="rounded-xl bg-brand-50 p-4 dark:bg-brand-900/30"><p className="text-xs text-ink-500">{paying?.number}</p><p className="text-2xl font-extrabold">{money(paying?.total)}</p></div><p className="text-xs text-ink-500">A sandbox payment will be created and marked successful instantly. No real money moves.</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setPaying(null)}>Cancel</Button><Button onClick={pay} disabled={busy}><CreditCard size={15} /> {busy ? 'Processing…' : 'Pay now'}</Button></div></div></Modal>
  </>;
}
