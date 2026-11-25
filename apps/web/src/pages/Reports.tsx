import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, Download, FileText, TrendingUp, UsersRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, PageHeader, Progress, SectionTitle, useToast } from '../components/ui';
import { fmtDate, pct } from '../lib/utils';

export default function Reports() {
  const { isStaff, children } = useAuth();
  const [studentId, setStudentId] = useState<string>(children[0] ? String(children[0].id) : '');
  const path = isStaff ? '/reports' : `/reports${studentId ? `?studentId=${studentId}` : ''}`;
  const { data, error, loading, reload } = useApi<any[]>(path, [studentId]);
  const { data: tests } = useApi<any[]>(isStaff ? null : '/tests', [studentId]);
  const toast = useToast();
  const reports = data || [];
  const report = reports[0];

  const trend = (tests || []).filter((t) => t.score !== undefined && t.score !== null).map((t, i) => ({ name: `Test ${i + 1}`, score: Math.round((t.score / (t.max_score || 10)) * 100) }));
  const skills = report ? Object.entries(report.skills || {}).map(([subject, value]) => ({ subject, value: Number(value) })) : [];

  if (error) return <ErrorBox error={error} retry={reload} />;
  return <>
    <PageHeader title="Performance reports" subtitle={isStaff ? 'Report cards across all batches.' : 'Scores, skills and tutor remarks in one view.'} action={!isStaff && children.length > 1 ? <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">{children.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : undefined} />
    {loading && !data ? <Card><div className="h-64 animate-pulse rounded bg-slate-200/60" /></Card>
      : !reports.length ? <EmptyState icon={FileText} title="No reports yet" description="Report cards are generated after assessments." />
      : isStaff ? <Card><SectionTitle title={`${reports.length} report cards`} /><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-ink-500"><tr><th className="py-2">Student</th><th>Batch</th><th>Period</th><th>Attendance</th><th>Homework</th><th>Rank</th><th></th></tr></thead><tbody>{reports.map((r) => <tr key={r.id} className="border-t border-ink-100 dark:border-slate-800"><td className="py-2 font-bold">{r.student_name}</td><td>{r.batch_name}</td><td>{r.period}</td><td>{pct(r.attendance_pct)}</td><td>{pct(r.homework_pct)}</td><td>{r.rank}/{r.total_students}</td><td><button onClick={() => api.download(`/reports/${r.id}/pdf`, `report-${r.student_id}.pdf`).catch((e: any) => toast(e.message, 'error'))} className="text-brand-600"><Download size={14} /></button></td></tr>)}</tbody></table></div></Card>
      : <>
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="bg-gradient-to-br from-brand-600 to-brand-800 !text-white"><p className="text-xs text-brand-100">Latest report · {report.period}</p><h2 className="mt-2 text-xl font-extrabold">{report.student_name}</h2><p className="text-xs text-brand-100">{report.batch_name}</p><div className="mt-5 grid grid-cols-2 gap-3"><div><p className="text-2xl font-extrabold">{pct(report.attendance_pct)}</p><p className="text-[10px] text-brand-100">Attendance</p></div><div><p className="text-2xl font-extrabold">{pct(report.homework_pct)}</p><p className="text-[10px] text-brand-100">Homework</p></div></div><Button variant="outline" size="sm" className="mt-5 !bg-white !text-brand-700" onClick={() => api.download(`/reports/${report.id}/pdf`, `report-${report.student_id}.pdf`).catch((e: any) => toast(e.message, 'error'))}><Download size={14} /> Download PDF</Button></Card>
          <Card className="lg:col-span-2"><SectionTitle title="Skill breakdown" /><div className="h-64">{skills.length ? <ResponsiveContainer width="100%" height="100%"><RadarChart data={skills}><PolarGrid stroke="#cbd5e1" /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} /><Radar dataKey="value" stroke="#1f6f5c" fill="#1f6f5c" fillOpacity={0.25} /></RadarChart></ResponsiveContainer> : <p className="text-sm text-ink-500">No skill data.</p>}</div></Card>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card><SectionTitle title="Test scores over time" action={<TrendingUp size={16} className="text-brand-600" />} /><div className="h-56">{trend.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#1f6f5c" strokeWidth={2} dot={{ r: 4, fill: '#c9872c' }} /></LineChart></ResponsiveContainer> : <EmptyState icon={Award} title="No test attempts yet" />}</div></Card>
          <div className="space-y-5"><Card><SectionTitle title="Batch standing" /><div className="flex items-center gap-4"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-sand-100 text-2xl font-extrabold text-sand-500 dark:bg-sand-500/20">#{report.rank}</div><div><p className="text-sm font-bold">Rank {report.rank} of {report.total_students}</p><p className="text-xs text-ink-500">Based on tests, attendance and homework.</p></div></div><Progress value={100 - ((report.rank - 1) / Math.max(1, report.total_students)) * 100} className="mt-4" /></Card>
            <Card><SectionTitle title="Tutor remarks" /><p className="text-sm leading-relaxed text-ink-500 dark:text-slate-300">{report.remarks || 'No remarks recorded.'}</p><p className="mt-3 text-[11px] text-ink-500">Generated {fmtDate(report.generated_at)} · <UsersRound size={11} className="inline" /> verified by your tutor</p></Card></div>
        </div>
        {reports.length > 1 && <Card className="mt-5"><SectionTitle title="Previous reports" /><div className="space-y-2">{reports.slice(1).map((r) => <div key={r.id} className="flex items-center justify-between rounded-xl bg-ink-50 p-3 text-xs dark:bg-slate-800"><span className="font-bold">{r.period}</span><span>{pct(r.attendance_pct)} attendance · rank {r.rank}</span><button onClick={() => api.download(`/reports/${r.id}/pdf`, `report-${r.student_id}.pdf`).catch((e: any) => toast(e.message, 'error'))} className="text-brand-600"><Download size={14} /></button></div>)}</div></Card>}
      </>}
  </>;
}

