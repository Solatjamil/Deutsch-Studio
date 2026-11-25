import { useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BookOpen, Building2, CheckCircle2, FileSpreadsheet, Plus, Upload, UsersRound, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, SectionTitle, Select, Tabs, Textarea, useToast } from '../components/ui';
import { fmtDate, money } from '../lib/utils';

export default function Admin() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('overview');
  const { data: overview, error, reload } = useApi<any>('/admin/overview');
  const { data: users, reload: reloadUsers } = useApi<any[]>('/admin/users');
  const { data: batches, reload: reloadBatches } = useApi<any[]>('/batches');
  const { data: courses, reload: reloadCourses } = useApi<any[]>('/courses');
  const { data: analytics } = useApi<any>('/admin/analytics');
  const { data: audit } = useApi<any[]>(isAdmin ? '/admin/audit' : null);
  const { data: deletion, reload: reloadDeletion } = useApi<any[]>(isAdmin ? '/admin/deletion-requests' : null);
  const { data: reports } = useApi<any[]>('/chat/reports');
  const { data: institute, reload: reloadInstitute } = useApi<any>('/institute');
  const fileRef = useRef<HTMLInputElement>(null);
  const [userModal, setUserModal] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [courseModal, setCourseModal] = useState(false);
  const [moduleModal, setModuleModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', phone: '', email: '', role: 'student', level: 'A1', batchId: '' });
  const [batchForm, setBatchForm] = useState({ name: '', courseId: '', startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) });
  const [courseForm, setCourseForm] = useState({ title: '', code: '', level: 'A1', description: '', price: 12000 });
  const [moduleForm, setModuleForm] = useState({ courseId: '', title: '', videoTitle: '', videoUrl: '' });
  const [materialForm, setMaterialForm] = useState({ title: '', type: 'pdf', level: 'A1', topic: '', url: '' });

  const createUser = async () => {
    setBusy(true);
    try { await api.post('/admin/users', { ...userForm, batchId: userForm.batchId ? Number(userForm.batchId) : undefined, email: userForm.email || undefined }); toast('User created. Default password: Demo1234!'); setUserModal(false); reloadUsers(); }
    catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const createBatch = async () => {
    try { await api.post('/admin/batches', { ...batchForm, courseId: Number(batchForm.courseId) }); toast('Batch created.'); setBatchModal(false); reloadBatches(); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const createCourse = async () => {
    try { await api.post('/admin/courses', { ...courseForm, price: Number(courseForm.price) }); toast('Course created.'); setCourseModal(false); reloadCourses(); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const createModule = async () => {
    try { await api.post(`/admin/courses/${moduleForm.courseId}/modules`, { title: moduleForm.title, lessons: moduleForm.videoTitle ? [{ title: moduleForm.videoTitle, videoUrl: moduleForm.videoUrl }] : [] }); toast('Module added.'); setModuleModal(false); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const addMaterial = async () => {
    try { await api.post('/materials', materialForm); toast('Material published.'); setMaterialForm({ title: '', type: 'pdf', level: 'A1', topic: '', url: '' }); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const importCsv = async (file: File) => {
    const form = new FormData(); form.append('file', file);
    try { const res = await api.upload('/admin/import-students', form); toast(`${res.created} students imported, ${res.skipped} skipped.`); reloadUsers(); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const uploadFile = async (file: File) => {
    const form = new FormData(); form.append('files', file); form.append('purpose', 'material');
    try { const res = await api.upload('/admin/upload', form); setMaterialForm((m) => ({ ...m, title: m.title || file.name, url: res.files[0].url })); toast('File uploaded. Add its details below.'); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const saveSettings = async () => {
    try { await api.put('/institute', settingsForm); toast('Institute settings saved.'); reloadInstitute(); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const resolveDeletion = async (id: number, status: string) => {
    try { await api.patch(`/admin/deletion-requests/${id}`, { status }); toast(`Request ${status}.`); reloadDeletion(); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  if (error) return <ErrorBox error={error} retry={reload} />;
  return <>
    <PageHeader title="Tutor / Admin console" subtitle="Manage people, batches, content and institute settings." action={<Badge tone="green"><Activity size={12} className="mr-1 inline" /> Live</Badge>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'people', label: 'People' }, { id: 'content', label: 'Content' }, { id: 'analytics', label: 'Analytics' }, { id: 'settings', label: 'Settings' }, { id: 'moderation', label: 'Moderation', badge: (deletion || []).filter((d) => d.status === 'pending').length + (reports || []).length }]} />

    {tab === 'overview' && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[[UsersRound, 'Students', overview?.students], [UsersRound, 'Parents', overview?.parents], [BookOpen, 'Batches', overview?.batches], [Wallet, 'Collected', money(overview?.collection)]].map(([Icon, label, value]: any) => <Card key={label} className="!p-4"><Icon size={18} className="text-brand-600" /><p className="mt-2 text-[11px] text-ink-500">{label}</p><p className="text-xl font-extrabold">{value}</p></Card>)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card><SectionTitle title="Attendance rate" /><p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">{overview?.attendance?.n ? Math.round((overview.attendance.p / overview.attendance.n) * 100) : 0}%</p><p className="text-xs text-ink-500">{overview?.attendance?.p || 0} of {overview?.attendance?.n || 0} records present or late</p></Card>
        <Card><SectionTitle title="Homework completion" /><p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">{overview?.submissions?.n ? Math.round((overview.submissions.reviewed / overview.submissions.n) * 100) : 0}%</p><p className="text-xs text-ink-500">{overview?.submissions?.reviewed || 0} of {overview?.submissions?.n || 0} submissions reviewed</p></Card>
      </div>
    </>}

    {tab === 'people' && <>
      <div className="mb-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => setUserModal(true)}><Plus size={15} /> Add user</Button><Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><FileSpreadsheet size={15} /> Import CSV</Button><Button size="sm" variant="outline" onClick={() => setBatchModal(true)}><Plus size={15} /> New batch</Button><input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} /></div>
      <Card><SectionTitle title={`Users (${users?.length || 0})`} /><div className="max-h-[520px] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-white text-ink-500 dark:bg-slate-900"><tr><th className="py-2">Name</th><th>Phone</th><th>Role</th><th>Level</th><th>Batch</th><th>Status</th></tr></thead><tbody>{users?.map((u) => <tr key={u.id} className="border-t border-ink-100 dark:border-slate-800"><td className="py-2 font-bold">{u.name}</td><td>{u.phone}</td><td className="capitalize">{u.role}</td><td>{u.level || '—'}</td><td>{u.batch_name || '—'}</td><td><Badge>{u.status}</Badge></td></tr>)}</tbody></table></div></Card>
      <Card className="mt-5"><SectionTitle title="Batches" /><div className="grid gap-2 sm:grid-cols-2">{batches?.map((b) => <div key={b.id} className="flex items-center justify-between rounded-xl bg-ink-50 p-3 text-xs dark:bg-slate-800"><span className="font-bold">{b.name}</span><span>{b.students} students · {fmtDate(b.start_date)}</span></div>)}</div></Card>
    </>}

    {tab === 'content' && <>
      <div className="mb-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => setCourseModal(true)}><Plus size={15} /> New course</Button><Button size="sm" variant="outline" onClick={() => setModuleModal(true)}><BookOpen size={15} /> Add module / lesson</Button></div>
      <div className="grid gap-5 lg:grid-cols-2"><Card><SectionTitle title={`Courses (${courses?.length || 0})`} /><div className="max-h-80 space-y-2 overflow-y-auto">{courses?.map((c) => <div key={c.id} className="flex items-center justify-between rounded-xl bg-ink-50 p-3 text-xs dark:bg-slate-800"><span className="font-bold">{c.title}</span><span>{c.code} · {money(c.price)}</span></div>)}</div></Card>
        <Card><SectionTitle title="Publish study material" /><div className="space-y-3"><Field label="Title"><Input value={materialForm.title} onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Type"><Select value={materialForm.type} onChange={(e) => setMaterialForm({ ...materialForm, type: e.target.value })}>{['pdf', 'vocab', 'grammar', 'audio', 'ebook'].map((t) => <option key={t}>{t}</option>)}</Select></Field><Field label="Level"><Select value={materialForm.level} onChange={(e) => setMaterialForm({ ...materialForm, level: e.target.value })}>{['A1', 'A2', 'B1', 'B2', 'C1'].map((l) => <option key={l}>{l}</option>)}</Select></Field></div><Field label="Topic"><Input value={materialForm.topic} onChange={(e) => setMaterialForm({ ...materialForm, topic: e.target.value })} /></Field><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Upload file</Button><input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} /><Input value={materialForm.url} onChange={(e) => setMaterialForm({ ...materialForm, url: e.target.value })} placeholder="Or paste a file URL" className="h-9 flex-1" /></div><Button size="sm" onClick={addMaterial} disabled={!materialForm.title}>Publish</Button></div></Card></div>
    </>}

    {tab === 'analytics' && <>
      <div className="grid gap-5 lg:grid-cols-2"><Card><SectionTitle title="Attendance trend" /><div className="h-64">{analytics?.attendanceTrend?.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.attendanceTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="pct" stroke="#1f6f5c" strokeWidth={2} /></LineChart></ResponsiveContainer> : <p className="text-xs text-ink-500">No data.</p>}</div></Card>
        <Card><SectionTitle title="Revenue" /><div className="h-64">{analytics?.revenue?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.revenue}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="amount" fill="#c9872c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="text-xs text-ink-500">No data.</p>}</div></Card></div>
      <Card className="mt-5"><SectionTitle title="Top performers" /><div className="space-y-2">{analytics?.performers?.map((p: any, i: number) => <div key={p.id} className="flex items-center gap-3 rounded-xl bg-ink-50 p-3 text-xs dark:bg-slate-800"><span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-white">{i + 1}</span><span className="flex-1 font-bold">{p.name}</span><span>Avg {Math.round(p.score || 0)}% · attendance {Math.round(p.attendance || 0)}%</span></div>)}</div></Card>
    </>}

    {tab === 'settings' && <>
      <Card><SectionTitle title="Institute settings" /><div className="grid gap-3 sm:grid-cols-2"><Field label="Institute name"><Input value={settingsForm?.name ?? institute?.name ?? ''} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value, tagline: settingsForm?.tagline ?? institute?.tagline, contact: settingsForm?.contact ?? institute?.contact, policies: settingsForm?.policies ?? institute?.policies, address: settingsForm?.address ?? institute?.address })} /></Field><Field label="Tagline"><Input value={settingsForm?.tagline ?? institute?.tagline ?? ''} onChange={(e) => setSettingsForm({ ...settingsForm, name: settingsForm?.name ?? institute?.name, tagline: e.target.value, contact: settingsForm?.contact ?? institute?.contact, policies: settingsForm?.policies ?? institute?.policies, address: settingsForm?.address ?? institute?.address })} /></Field><Field label="Contact email"><Input value={settingsForm?.contact?.email ?? institute?.contact?.email ?? ''} onChange={(e) => setSettingsForm({ ...settingsForm, name: settingsForm?.name ?? institute?.name, tagline: settingsForm?.tagline ?? institute?.tagline, contact: { ...(settingsForm?.contact ?? institute?.contact), email: e.target.value }, policies: settingsForm?.policies ?? institute?.policies, address: settingsForm?.address ?? institute?.address })} /></Field><Field label="Phone"><Input value={settingsForm?.contact?.phone ?? institute?.contact?.phone ?? ''} onChange={(e) => setSettingsForm({ ...settingsForm, name: settingsForm?.name ?? institute?.name, tagline: settingsForm?.tagline ?? institute?.tagline, contact: { ...(settingsForm?.contact ?? institute?.contact), phone: e.target.value }, policies: settingsForm?.policies ?? institute?.policies, address: settingsForm?.address ?? institute?.address })} /></Field><Field label="Address" className="sm:col-span-2"><Input value={settingsForm?.address ?? institute?.address ?? ''} onChange={(e) => setSettingsForm({ ...settingsForm, name: settingsForm?.name ?? institute?.name, tagline: settingsForm?.tagline ?? institute?.tagline, contact: settingsForm?.contact ?? institute?.contact, policies: settingsForm?.policies ?? institute?.policies, address: e.target.value })} /></Field><Field label="Policies text" className="sm:col-span-2"><Textarea value={settingsForm?.policies ?? institute?.policies ?? ''} onChange={(e) => setSettingsForm({ ...settingsForm, name: settingsForm?.name ?? institute?.name, tagline: settingsForm?.tagline ?? institute?.tagline, contact: settingsForm?.contact ?? institute?.contact, policies: e.target.value, address: settingsForm?.address ?? institute?.address })} /></Field></div><Button className="mt-4" onClick={saveSettings}>Save settings</Button></Card>
      <Card className="mt-5"><SectionTitle title="Audit log" /><div className="max-h-72 space-y-2 overflow-y-auto">{audit?.map((a) => <div key={a.id} className="flex items-center justify-between rounded-xl bg-ink-50 p-2.5 text-[11px] dark:bg-slate-800"><span className="font-semibold">{a.action}</span><span className="text-ink-500">{a.actor || 'system'} · {fmtDate(a.created_at)}</span></div>)}{!isAdmin ? <p className="text-xs text-ink-500">Admin-only section.</p> : !audit?.length && <p className="text-xs text-ink-500">No admin actions recorded yet.</p>}</div></Card>
    </>}

    {tab === 'moderation' && <div className="grid gap-5 lg:grid-cols-2"><Card><SectionTitle title="Data deletion requests" />{deletion?.map((d) => <div key={d.id} className="mb-2 rounded-xl border border-ink-100 p-3 text-xs dark:border-slate-800"><p className="font-bold">{d.name} · <Badge>{d.status}</Badge></p><p className="mt-1 text-ink-500">{d.reason || 'No reason given'} · {fmtDate(d.created_at)}</p>{d.status === 'pending' && <div className="mt-2 flex gap-2"><Button size="sm" variant="danger" onClick={() => resolveDeletion(d.id, 'approved')}>Approve</Button><Button size="sm" variant="outline" onClick={() => resolveDeletion(d.id, 'rejected')}>Reject</Button></div>}</div>)}{!isAdmin ? <p className="text-xs text-ink-500">Admin-only section.</p> : !deletion?.length && <p className="text-xs text-ink-500">No requests.</p>}</Card>
      <Card><SectionTitle title="Reported messages" />{reports?.map((r) => <div key={r.id} className="mb-2 rounded-xl border border-ink-100 p-3 text-xs dark:border-slate-800"><p className="font-bold">{r.reporter_name} · <Badge>{r.status}</Badge></p><p className="mt-1 text-ink-500">“{r.body}”</p><p className="mt-1">{r.reason}</p></div>)}{!reports?.length && <p className="text-xs text-ink-500">No reports.</p>}</Card></div>}

    <Modal open={userModal} onClose={() => setUserModal(false)} title="Add a user"><div className="space-y-3"><Field label="Name"><Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Phone"><Input value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} /></Field><Field label="Email"><Input value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="Role"><Select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>{['student', 'parent', 'tutor', 'admin'].map((r) => <option key={r}>{r}</option>)}</Select></Field><Field label="Level"><Input value={userForm.level} onChange={(e) => setUserForm({ ...userForm, level: e.target.value })} /></Field></div><Field label="Batch (optional)"><Select value={userForm.batchId} onChange={(e) => setUserForm({ ...userForm, batchId: e.target.value })}><option value="">None</option>{batches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setUserModal(false)}>Cancel</Button><Button onClick={createUser} disabled={busy || !userForm.name || !userForm.phone}>Create user</Button></div></div></Modal>
    <Modal open={batchModal} onClose={() => setBatchModal(false)} title="Create batch"><div className="space-y-3"><Field label="Batch name"><Input value={batchForm.name} onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} /></Field><Field label="Course"><Select value={batchForm.courseId} onChange={(e) => setBatchForm({ ...batchForm, courseId: e.target.value })}><option value="">Choose course</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field><div className="grid grid-cols-2 gap-3"><Field label="Start"><Input type="date" value={batchForm.startDate} onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })} /></Field><Field label="End"><Input type="date" value={batchForm.endDate} onChange={(e) => setBatchForm({ ...batchForm, endDate: e.target.value })} /></Field></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setBatchModal(false)}>Cancel</Button><Button onClick={createBatch} disabled={!batchForm.name || !batchForm.courseId}>Create</Button></div></div></Modal>
    <Modal open={courseModal} onClose={() => setCourseModal(false)} title="Create course"><div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Field label="Title"><Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} /></Field><Field label="Code"><Input value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} /></Field></div><Field label="Description"><Textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Level"><Input value={courseForm.level} onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })} /></Field><Field label="Price"><Input type="number" value={courseForm.price} onChange={(e) => setCourseForm({ ...courseForm, price: Number(e.target.value) })} /></Field></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCourseModal(false)}>Cancel</Button><Button onClick={createCourse} disabled={!courseForm.title || !courseForm.code}>Create course</Button></div></div></Modal>
    <Modal open={moduleModal} onClose={() => setModuleModal(false)} title="Add module & lesson"><div className="space-y-3"><Field label="Course"><Select value={moduleForm.courseId} onChange={(e) => setModuleForm({ ...moduleForm, courseId: e.target.value })}><option value="">Choose course</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field><Field label="Module title"><Input value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} /></Field><Field label="First lesson title (optional)"><Input value={moduleForm.videoTitle} onChange={(e) => setModuleForm({ ...moduleForm, videoTitle: e.target.value })} /></Field><Field label="Video URL"><Input value={moduleForm.videoUrl} onChange={(e) => setModuleForm({ ...moduleForm, videoUrl: e.target.value })} placeholder="https://…" /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setModuleModal(false)}>Cancel</Button><Button onClick={createModule} disabled={!moduleForm.courseId || !moduleForm.title}>Add module</Button></div></div></Modal>
  </>;
}
