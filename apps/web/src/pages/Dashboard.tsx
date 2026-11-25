import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, Clock, CreditCard, Megaphone, Play, Plus, ReceiptText, TrendingUp, UsersRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, PageHeader, Progress, SectionTitle, Skeleton, useToast } from '../components/ui';
import { fmtDateTime, fmtTime, money, pct, relative } from '../lib/utils';
import { api } from '../lib/api';

function Kpi({ icon: Icon, label, value, sub, color = 'text-brand-600' }: any) {
  return <Card className="flex items-center gap-3 !p-4"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 dark:bg-brand-900/30 ${color}`}><Icon size={19} /></span><div className="min-w-0"><p className="truncate text-[11px] font-medium text-ink-500 dark:text-slate-400">{label}</p><p className="text-xl font-extrabold leading-tight">{value}</p>{sub && <p className="truncate text-[10px] text-ink-500">{sub}</p>}</div></Card>;
}

function ClassRow({ s, onJoin }: { s: any; onJoin?: (s: any) => void }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-ink-100 p-3 dark:border-slate-800">
    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${s.is_live ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'bg-brand-50 text-brand-600 dark:bg-brand-900/30'}`}><CalendarDays size={20} /></div>
    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{s.title}</p>{s.is_live ? <Badge tone="red">live</Badge> : <Badge tone="slate">{fmtTime(s.starts_at)}</Badge>}</div><p className="truncate text-xs text-ink-500 dark:text-slate-400">{s.batch_name} · {fmtDateTime(s.starts_at)}</p></div>
    {onJoin ? <Button size="sm" className="shrink-0" onClick={() => onJoin(s)}>{s.is_live ? 'Join' : 'Details'}</Button> : <Link to="/app/classes" className="text-brand-600"><ArrowRight size={17} /></Link>}
  </div>;
}

export default function Dashboard() {
  const { user, children } = useAuth();
  const [childId, setChildId] = useState(children[0] ? String(children[0].id) : '');
  const { data, loading, error, reload } = useApi(`/dashboard${childId && user?.role === 'parent' ? `?childId=${childId}` : ''}`, [childId]);
  const toast = useToast();
  const [joining, setJoining] = useState<number | null>(null);

  if (loading && !data) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><div className="grid gap-3 sm:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-64 w-full" /></div>;
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!data) return null;

  const greet = user?.name?.split(' ')[0] || 'there';
  const join = async (s: any) => {
    setJoining(s.id);
    try {
      const res = await api.post(`/sessions/${s.id}/join`);
      toast('Attendance marked. Opening your class…');
      if (res.meetingUrl) window.open(res.meetingUrl, '_blank', 'noopener,noreferrer');
      reload();
    } catch (e: any) { toast(e.message, 'error'); }
    finally { setJoining(null); }
  };

  if (data.role === 'tutor') return <>
    <PageHeader title={`Guten Tag, ${greet}!`} subtitle="Here is what needs your attention today." action={<Link to="/app/admin"><Button size="sm"><Plus size={15} /> Quick action</Button></Link>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi icon={UsersRound} label="Active students" value={data.kpis.students} sub={`${data.kpis.batches} batches`} />
      <Kpi icon={Clock} label="Attendance to mark" value={data.sessions.filter((s: any) => s.needsAttendance).length} sub="sessions today" color="text-amber-600" />
      <Kpi icon={ClipboardCheck} label=" Homework reviews" value={data.kpis.pendingReviews} sub="awaiting feedback" color="text-purple-600" />
      <Kpi icon={CreditCard} label="Fee defaulters" value={data.kpis.defaulters} sub={`${data.kpis.collectionRate}% collected`} color="text-red-600" />
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2"><SectionTitle title="Today's schedule" action={<Link to="/app/classes" className="text-xs font-bold text-brand-600">View calendar</Link>} />
        <div className="space-y-2">{data.sessions.length ? data.sessions.map((s: any) => <ClassRow key={s.id} s={s} />) : <EmptyState icon={CalendarDays} title="No classes today" description="Enjoy the breathing room." />}</div>
      </Card>
      <Card><SectionTitle title="Homework to review" action={<Link to="/app/homework" className="text-xs font-bold text-brand-600">All work</Link>} />
        <div className="space-y-3">{data.pendingReviews.length ? data.pendingReviews.map((h: any) => <Link key={h.id} to={`/app/homework/${h.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink-50 dark:hover:bg-slate-800"><span className="grid h-9 w-9 place-items-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-500/10"><ClipboardCheck size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{h.title}</p><p className="text-[11px] text-ink-500">{h.student_name} · {relative(h.submitted_at)}</p></div></Link>) : <p className="text-sm text-ink-500">All caught up 🎉</p>}</div>
      </Card>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <Card><SectionTitle title="Fee defaulters" action={<Link to="/app/fees" className="text-xs font-bold text-brand-600">Open ledger</Link>} />
        {data.defaulters.length ? <div className="space-y-2">{data.defaulters.slice(0, 5).map((d: any) => <div key={d.id} className="flex items-center justify-between rounded-xl bg-ink-50 p-3 text-sm dark:bg-slate-800"><span className="font-semibold">{d.name}</span><span className="font-bold text-red-600">{money(d.total)}</span></div>)}</div> : <p className="text-sm text-ink-500">No dues right now.</p>}
      </Card>
      <Card><SectionTitle title="Latest announcement" action={<Link to="/app/announcements" className="text-xs font-bold text-brand-600">All posts</Link>} />
        {data.announcements[0] ? <div><Badge tone="blue">Institute</Badge><h3 className="mt-2 font-bold">{data.announcements[0].title}</h3><p className="mt-1 text-sm text-ink-500 dark:text-slate-400">{data.announcements[0].body}</p><p className="mt-2 text-[11px] text-ink-500">{relative(data.announcements[0].created_at)}</p></div> : <p className="text-sm text-ink-500">Nothing posted yet.</p>}
      </Card>
    </div>
  </>;

  if (data.role === 'parent') return <>
    <PageHeader title={`Namaste, ${greet}!`} subtitle="A clear view of your child's progress." action={children.length > 1 ? <select value={childId} onChange={(e) => setChildId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">{children.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : undefined} />
    <Card className="mb-5 flex flex-wrap items-center gap-4 bg-gradient-to-br from-brand-600 to-brand-800 !text-white">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20 text-2xl font-extrabold">{data.child?.name?.[0] || '?'}</div>
      <div className="flex-1"><p className="text-xs text-brand-100">Viewing</p><h2 className="text-xl font-extrabold">{data.child?.name || 'No child linked'}</h2><p className="text-xs text-brand-100">{data.child?.level || '—'} · {data.report?.batch_name || 'No batch'}</p></div>
      <Link to="/app/reports"><Button variant="outline" className="!bg-white !text-brand-700">Full report <ArrowRight size={15} /></Button></Link>
    </Card>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi icon={TrendingUp} label="Attendance" value={pct(data.attendance?.pct)} sub={`${data.attendance?.present || 0} of ${data.attendance?.total || 0} classes`} />
      <Kpi icon={ClipboardCheck} label="Homework done" value={`${data.homework.filter((h: any) => ['submitted', 'reviewed', 'late'].includes(h.status)).length}/${data.homework.length}`} sub="assignments" color="text-purple-600" />
      <Kpi icon={CreditCard} label="Fee status" value={money(data.fees?.due)} sub={data.fees?.due ? 'due soon' : 'all clear'} color={data.fees?.due ? 'text-red-600' : 'text-emerald-600'} />
      <Kpi icon={BookOpen} label="Latest report" value={data.report ? `${data.report.rank}/${data.report.total_students}` : '—'} sub="batch rank" color="text-sand-500" />
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2"><SectionTitle title="Upcoming classes" action={<Link to="/app/classes" className="text-xs font-bold text-brand-600">Calendar</Link>} />
        <div className="space-y-2">{data.sessions.length ? data.sessions.map((s: any) => <ClassRow key={s.id} s={s} />) : <EmptyState icon={CalendarDays} title="No upcoming classes" />}</div>
      </Card>
      <Card><SectionTitle title="Homework status" action={<Link to="/app/homework" className="text-xs font-bold text-brand-600">Details</Link>} />
        <div className="space-y-2">{data.homework.slice(0, 5).map((h: any, i: number) => <div key={i} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{h.title}</span><Badge>{h.status}</Badge></div>)}</div>
      </Card>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <Card><SectionTitle title="Latest report card" /><p className="text-sm font-bold">{data.report?.period || 'No report yet'}</p><p className="mt-2 text-sm text-ink-500 dark:text-slate-400">{data.report?.remarks || 'Reports will appear here after the first assessment.'}</p>{data.report && <div className="mt-3"><Progress value={data.report.attendance_pct} /><p className="mt-1 text-xs text-ink-500">Attendance {pct(data.report.attendance_pct)}</p></div>}</Card>
      <Card><SectionTitle title="Announcements" action={<Link to="/app/announcements" className="text-xs font-bold text-brand-600">View all</Link>} />{data.announcements[0] ? <><h3 className="font-bold">{data.announcements[0].title}</h3><p className="mt-1 text-sm text-ink-500">{data.announcements[0].body}</p></> : <p className="text-sm text-ink-500">No announcements yet.</p>}</Card>
    </div>
  </>;

  return <>
    <PageHeader title={`Guten Tag, ${greet}!`} subtitle="Everything you need for today, in one place." action={<Link to="/app/courses"><Button size="sm"><BookOpen size={15} /> Browse courses</Button></Link>} />
    {data.feeDue > 0 && <Link to="/app/fees" className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-500/10"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"><ReceiptText size={18} /></span><span className="flex-1"><strong>Fee payment due:</strong> {money(data.feeDue)}. Keep your enrollment active.</span><ArrowRight size={16} /></Link>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi icon={TrendingUp} label="Attendance" value={pct(data.attendance?.pct)} sub={`${data.attendance?.present || 0} classes present`} />
      <Kpi icon={ClipboardCheck} label="Pending homework" value={data.pendingHomework} sub="needs your attention" color="text-purple-600" />
      <Kpi icon={Clock} label="Classes ahead" value={data.sessions.length} sub="this week" color="text-sand-500" />
      <Kpi icon={CreditCard} label="Fee due" value={money(data.feeDue)} sub={data.feeDue ? 'pay when ready' : 'all clear'} color={data.feeDue ? 'text-red-600' : 'text-emerald-600'} />
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <Card className="min-w-0 lg:col-span-2"><SectionTitle title="Today's classes" action={<Link to="/app/classes" className="shrink-0 text-xs font-bold text-brand-600">Full schedule</Link>} />
        <div className="space-y-2">{data.sessions.length ? data.sessions.map((s: any) => <ClassRow key={s.id} s={s} onJoin={join} />) : <EmptyState icon={CalendarDays} title="No classes right now" description="Check the calendar for your next session." action={<Link to="/app/classes"><Button size="sm">Open calendar</Button></Link>} />}
        {joining && <p className="text-xs text-ink-500">Opening meeting…</p>}</div>
      </Card>
      <Card className="min-w-0"><SectionTitle title="Homework" action={<Link to="/app/homework" className="shrink-0 text-xs font-bold text-brand-600">See all</Link>} />
        <div className="space-y-2">{data.homework.filter((h: any) => ['pending', 'late'].includes(h.status)).slice(0, 5).map((h: any) => <Link key={h.id} to={`/app/homework/${h.id}`} className="flex min-w-0 items-center gap-2 rounded-xl p-2 hover:bg-ink-50 dark:hover:bg-slate-800"><span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-500/10"><ClipboardCheck size={15} /></span><span className="min-w-0 flex-1"><span className="block min-w-0 truncate text-xs font-bold">{h.title}</span><span className="text-[10px] text-ink-500">Due {h.due_at ? new Date(h.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span></span><Badge tone={h.status}>{h.status}</Badge></Link>)}
          {!data.homework.some((h: any) => ['pending', 'late'].includes(h.status)) && <p className="text-sm text-ink-500">All homework submitted. Nice work! <CheckCircle2 size={15} className="inline text-emerald-500" /></p>}</div>
      </Card>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <Card><SectionTitle title="Continue watching" action={<Link to="/app/courses" className="text-xs font-bold text-brand-600">Video library</Link>} />
        {data.nextLesson ? <Link to={`/app/courses/${data.nextLesson.course_id}`} className="group block"><div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-brand-700 to-brand-900"><div className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-brand-700 shadow-lg group-hover:scale-105"><Play size={20} fill="currentColor" /></span></div><span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">{data.nextLesson.duration_min} min</span></div><p className="mt-3 text-sm font-bold">{data.nextLesson.title}</p><p className="text-xs text-ink-500">{data.nextLesson.course_title} · {data.nextLesson.module_title}</p></Link> : <p className="text-sm text-ink-500">Recordings will appear after enrollment.</p>}
      </Card>
      <Card><SectionTitle title="Your batches" action={<Link to="/app/courses" className="text-xs font-bold text-brand-600">All courses</Link>} />
        <div className="space-y-3">{data.batches.map((b: any) => <div key={b.id}><div className="flex items-center justify-between text-xs"><span className="font-bold">{b.name}</span><span>{pct(b.progress_pct)}</span></div><Progress value={b.progress_pct} className="mt-1.5" /></div>)}{!data.batches.length && <p className="text-sm text-ink-500">Enroll in a course to get started.</p>}</div>
      </Card>
      <Card><SectionTitle title="Latest announcement" action={<Link to="/app/announcements" className="text-xs font-bold text-brand-600">All</Link>} />
        {data.announcements[0] ? <div><div className="mb-2 flex items-center gap-2"><Megaphone size={16} className="text-brand-600" /><span className="text-[11px] text-ink-500">{relative(data.announcements[0].created_at)}</span></div><h3 className="font-bold">{data.announcements[0].title}</h3><p className="mt-1 text-sm text-ink-500 dark:text-slate-400">{data.announcements[0].body}</p></div> : <div className="flex items-center gap-2 text-sm text-ink-500"><Bell size={16} /> No announcements yet.</div>}
      </Card>
    </div>
  </>;
}
