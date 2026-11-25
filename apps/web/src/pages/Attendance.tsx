import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, Download, FileText, Save, UserCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Progress, SectionTitle, Textarea, useToast } from '../components/ui';
import { fmtDate, pct } from '../lib/utils';

const statusOptions = ['present', 'absent', 'late', 'leave'] as const;

function Heatmap({ records }: { records: any[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() - monthOffset);
  const year = base.getFullYear(), month = base.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1).getDay();
  const map: Record<string, string> = {};
  records.forEach((r) => { map[r.starts_at?.slice(0, 10)] = r.status; });
  const color = (status?: string) => status === 'present' ? 'bg-emerald-500' : status === 'late' ? 'bg-amber-400' : status === 'absent' ? 'bg-red-500' : status === 'leave' ? 'bg-slate-400' : 'bg-slate-100 dark:bg-slate-800';
  return <div>
    <div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold">{base.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setMonthOffset(Math.max(0, monthOffset - 1))}>←</Button><Button size="sm" variant="ghost" onClick={() => setMonthOffset(monthOffset + 1)}>→</Button></div></div>
    <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-ink-500">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1.5">{Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}{Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return <div key={key} title={`${key}: ${map[key] || 'no class'}`} className={`aspect-square rounded-md ${color(map[key])} grid place-items-center text-[9px] font-bold text-white`}>{day}</div>;
    })}</div>
    <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-ink-500">{statusOptions.map((s) => <span key={s} className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${color(s)}`} />{s}</span>)}</div>
  </div>;
}

export default function Attendance() {
  const { user, isStaff, children } = useAuth();
  const toast = useToast();
  const [studentId, setStudentId] = useState<string>(children[0] ? String(children[0].id) : '');
  const [batchId, setBatchId] = useState<string>('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState<Record<number, { status: string; reason?: string }>>({});
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leave, setLeave] = useState({ date: new Date().toISOString().slice(0, 10), reason: '' });

  const { data: batches } = useApi<any[]>('/batches', []);
  const { data: studentUsers } = useApi<any[]>(isStaff ? '/admin/users?role=student' : null, []);
  useEffect(() => { if (!batchId && batches?.length) setBatchId(String(batches[0].id)); }, [batches, batchId]);
  const summaryPath = isStaff ? (studentId ? `/attendance/summary?studentId=${studentId}` : null) : `/attendance/summary${studentId ? `?studentId=${studentId}` : ''}`;
  const { data: summary, error: summaryError, reload: reloadSummary } = useApi<any>(summaryPath, [studentId]);
  const { data: batchData, error: batchError, reload: reloadBatch } = useApi<any>(batchId ? `/attendance/batch/${batchId}?date=${date}` : null, [batchId, date]);
  const { data: leaves, reload: reloadLeaves } = useApi<any[]>('/leave-requests', []);

  useEffect(() => { if (batchData?.students) setRecords(Object.fromEntries(batchData.students.map((s: any) => [s.id, { status: s.status, reason: s.reason || '' }]))); }, [batchData]);

  const saveAttendance = async () => {
    try {
      const payload = Object.entries(records).map(([id, v]) => ({ studentId: Number(id), status: v.status as any, reason: v.reason }));
      await api.post(`/attendance/batch/${batchId}`, { date, sessionId: batchData?.session?.id, records: payload });
      toast(`Attendance saved for ${payload.length} students.`); reloadBatch(); reloadSummary();
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const markAll = () => setRecords(Object.fromEntries(Object.keys(records).map((id) => [id, { ...records[Number(id)], status: 'present' }])));
  const submitLeave = async () => {
    try { await api.post('/leave-requests', leave); toast('Leave request sent.'); setLeaveOpen(false); reloadLeaves(); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const reviewLeave = async (id: number, status: string) => {
    try { await api.patch(`/leave-requests/${id}`, { status }); toast(`Request ${status}.`); reloadLeaves(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  if (isStaff) return <>
    <PageHeader title="Attendance management" subtitle="Mark attendance, review leave requests and export records." />
    {(summaryError || batchError) && <ErrorBox error={summaryError || batchError} />}
    <Card className="mb-5 !p-4"><div className="flex flex-wrap items-end gap-3"><Field label="Batch" className="min-w-48 flex-1"><select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">{(batches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Button variant="outline" onClick={markAll}><CheckCircle2 size={15} /> Mark all present</Button><Button onClick={saveAttendance}><Save size={15} /> Save</Button></div>
      <p className="mt-3 text-[11px] text-ink-500">Edits are allowed for the current class window. Absences automatically notify linked parents.</p>
    </Card>
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2"><SectionTitle title="Students" action={<Button size="sm" variant="outline" onClick={() => api.download(`/attendance/export/${batchId}`, `attendance-${batchId}.csv`).catch((e) => toast(e.message, 'error'))}><Download size={14} /> Export CSV</Button>} />
        <div className="space-y-2">{batchData?.students?.map((s: any) => <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 p-3 dark:border-slate-800"><div className="min-w-32 flex-1"><p className="text-sm font-bold">{s.name}</p><p className="text-[11px] text-ink-500">Student</p></div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">{statusOptions.map((st) => <button key={st} onClick={() => setRecords({ ...records, [s.id]: { ...records[s.id], status: st } })} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold capitalize ${records[s.id]?.status === st ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900' : 'text-ink-500'}`}>{st}</button>)}</div>
        </div>)}{!batchData?.students?.length && <p className="text-sm text-ink-500">No students in this batch yet.</p>}</div>
      </Card>
      <div className="space-y-5">
        <Card><SectionTitle title="Leave requests" /><div className="space-y-3">{leaves?.filter((l) => l.status === 'pending').map((l) => <div key={l.id} className="rounded-xl border border-ink-100 p-3 dark:border-slate-800"><p className="text-xs font-bold">{l.student_name}</p><p className="text-[11px] text-ink-500">{fmtDate(l.date)} · {l.reason}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="secondary" onClick={() => reviewLeave(l.id, 'approved')}>Approve</Button><Button size="sm" variant="ghost" onClick={() => reviewLeave(l.id, 'rejected')}>Reject</Button></div></div>)}{!leaves?.some((l) => l.status === 'pending') && <p className="text-sm text-ink-500">No pending requests.</p>}</div></Card>
        {summary && <Card><SectionTitle title="Student snapshot" /><select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="mb-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Choose student</option>{(studentUsers || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <div className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">{pct(summary.pct)}</div><Progress value={summary.pct} className="mt-2" /><p className="mt-2 text-xs text-ink-500">{summary.present}/{summary.total} classes attended</p>
        </Card>}
      </div>
    </div>
  </>;

  return <>
    <PageHeader title="Your attendance" subtitle="A clear record of every class you attended." action={user?.role === 'student' ? <Button size="sm" onClick={() => setLeaveOpen(true)}><FileText size={15} /> Request leave</Button> : undefined} />
    {children.length > 1 && <Card className="mb-4 !p-3"><select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">{children.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Card>}
    {summaryError && <ErrorBox error={summaryError} retry={reloadSummary} />}
    {summary ? <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Attendance rate', pct(summary.pct), 'text-brand-600'], ['Present', summary.present, 'text-emerald-600'], ['Absent', summary.absent, 'text-red-600'], ['Late / leave', summary.late + summary.leave, 'text-amber-600']].map(([label, value, color]) => <Card key={String(label)} className="!p-4"><p className="text-[11px] text-ink-500">{label}</p><p className={`text-2xl font-extrabold ${color}`}>{value}</p></Card>)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card><SectionTitle title="Monthly heatmap" /><Heatmap records={summary.records || []} /></Card>
        <div className="space-y-5"><Card><SectionTitle title="Recent classes" /><div className="max-h-72 space-y-2 overflow-y-auto">{summary.records?.slice(0, 12).map((r: any) => <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 p-3 dark:bg-slate-800"><div className="min-w-0"><p className="truncate text-xs font-bold">{r.title}</p><p className="text-[10px] text-ink-500">{fmtDate(r.starts_at)}</p></div><Badge>{r.status}</Badge></div>)}{!summary.records?.length && <EmptyState icon={CalendarDays} title="No attendance records" />}</div></Card>
          <Card><SectionTitle title="My leave requests" /><div className="space-y-2">{summary.leaves?.map((l: any) => <div key={l.id} className="flex items-center justify-between rounded-xl bg-ink-50 p-3 text-xs dark:bg-slate-800"><span>{fmtDate(l.date)} · {l.reason}</span><Badge>{l.status}</Badge></div>)}{!summary.leaves?.length && <p className="text-xs text-ink-500">No leave requests yet.</p>}</div></Card></div>
      </div>
    </> : <Card><div className="h-64 animate-pulse rounded-xl bg-slate-200/60" /></Card>}
    <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Request leave"><div className="space-y-3"><Field label="Date"><Input type="date" value={leave.date} onChange={(e) => setLeave({ ...leave, date: e.target.value })} /></Field><Field label="Reason"><Textarea value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} placeholder="Why can't you attend?" /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setLeaveOpen(false)}>Cancel</Button><Button onClick={submitLeave} disabled={leave.reason.length < 4}>Submit</Button></div></div></Modal>
  </>;
}
