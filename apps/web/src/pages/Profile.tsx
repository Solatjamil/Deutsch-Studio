import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, Database, Download, GraduationCap, Link2, LogOut, Mail, Phone, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Textarea, useToast } from '../components/ui';
import { fmtDate } from '../lib/utils';

export default function Profile() {
  const { user, children, refresh, switchRole, institute } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', level: user?.level || 'A1', photo_url: '' });
  const [linkOpen, setLinkOpen] = useState(false);
  const [invite, setInvite] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try { await api.patch('/auth/profile', { name: form.name, level: form.level || null, ...(form.photo_url ? { photo_url: form.photo_url } : {}) }); await refresh(); toast('Profile updated.'); setEditing(false); }
    catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const link = async () => {
    try { await api.post('/auth/link-parent', { code: invite }); toast('Child linked successfully.'); await refresh(); setLinkOpen(false); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const exportData = async () => {
    try {
      const data = await api.get('/auth/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'deutsch-studio-my-data.json'; a.click(); URL.revokeObjectURL(url);
      toast('Your data export is downloading.');
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const requestDeletion = async () => {
    try { await api.post('/auth/delete-request', { reason }); toast('Deletion request recorded.'); setDeleteOpen(false); }
    catch (e: any) { toast(e.message, 'error'); }
  };

  return <>
    <PageHeader title="Profile" subtitle="Your account, preferences and privacy controls." />
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5">
        <Card className="text-center"><div className="relative mx-auto w-fit"><Avatar name={user?.name || ''} src={(user as any)?.photo_url} size={84} /><span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-white ring-2 ring-white dark:ring-slate-900"><Camera size={14} /></span></div>
          <h2 className="mt-3 text-lg font-extrabold">{user?.name}</h2><Badge tone="green" className="mt-2 capitalize">{user?.role}</Badge>
          <p className="mt-2 text-xs text-ink-500">{institute?.name || 'Deutsch Studio'}</p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => setEditing(true)}>Edit profile</Button>
        </Card>
        <Card><h2 className="mb-3 text-sm font-extrabold">Account details</h2><dl className="space-y-3 text-xs"><div className="flex items-center gap-2"><Phone size={14} className="text-ink-500" /><dt className="w-16 text-ink-500">Phone</dt><dd className="font-bold">{user?.phone}</dd></div><div className="flex items-center gap-2"><Mail size={14} className="text-ink-500" /><dt className="w-16 text-ink-500">Email</dt><dd className="truncate font-bold">{user?.email || '—'}</dd></div><div className="flex items-center gap-2"><GraduationCap size={14} className="text-ink-500" /><dt className="w-16 text-ink-500">Level</dt><dd className="font-bold">{user?.level || '—'}</dd></div><div className="flex items-center gap-2"><ShieldCheck size={14} className="text-ink-500" /><dt className="w-16 text-ink-500">Consent</dt><dd className="font-bold">{fmtDate((user as any)?.consent_at || new Date().toISOString())}</dd></div></dl></Card>
        <Card className="!p-4"><p className="text-xs font-bold text-ink-700 dark:text-slate-200">Switch demo role</p><p className="mt-1 text-[11px] text-ink-500">No login needed — jump between views.</p><div className="mt-3 grid grid-cols-2 gap-2">{['student', 'parent', 'tutor', 'admin'].map((r) => <Button key={r} size="sm" variant={user?.role === r ? 'primary' : 'outline'} className="capitalize" onClick={async () => { await switchRole(r); navigate('/app'); }}>{r}</Button>)}</div></Card>
      </div>
      <div className="space-y-5 lg:col-span-2">
        <Card><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30"><UserRound size={19} /></span><div><h2 className="text-sm font-extrabold">Personal information</h2><p className="text-xs text-ink-500">Only what is needed for your classes.</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-ink-50 p-3 dark:bg-slate-800"><p className="text-[10px] text-ink-500">Name</p><p className="text-sm font-bold">{user?.name}</p></div><div className="rounded-xl bg-ink-50 p-3 dark:bg-slate-800"><p className="text-[10px] text-ink-500">Role</p><p className="text-sm font-bold capitalize">{user?.role}</p></div></div>
        </Card>
        {user?.role === 'parent' && <Card><div className="flex items-center justify-between"><div><h2 className="text-sm font-extrabold">Linked children</h2><p className="text-xs text-ink-500">Invite codes connect a parent to a student.</p></div><Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}><Link2 size={14} /> Link child</Button></div>
          <div className="mt-3 space-y-2">{children.map((c: any) => <div key={c.id} className="flex items-center gap-2 rounded-xl bg-ink-50 p-3 dark:bg-slate-800"><Avatar name={c.name} size={30} /><span className="flex-1 text-sm font-bold">{c.name}</span><Badge>{c.level || '—'}</Badge></div>)}{!children.length && <p className="text-xs text-ink-500">No children linked yet.</p>}</div>
        </Card>}
        <Card><h2 className="text-sm font-extrabold">Privacy & your data</h2><p className="mt-1 text-xs text-ink-500">You can export your data or request deletion at any time.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><Button variant="outline" onClick={exportData}><Download size={16} /> Export my data</Button><Button variant="outline" onClick={() => setDeleteOpen(true)}><Trash2 size={16} /> Request data deletion</Button></div>
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle2 size={15} className="mr-1 inline" /> Consent recorded. We do not sell personal information.</div>
        </Card>
        <Card><h2 className="text-sm font-extrabold">More</h2><div className="mt-3 grid gap-2 sm:grid-cols-2"><Link to="/app/settings" className="rounded-xl border border-ink-100 p-3 text-xs font-bold hover:border-brand-400 dark:border-slate-800">Settings & language →</Link><Link to="/legal/privacy" className="rounded-xl border border-ink-100 p-3 text-xs font-bold hover:border-brand-400 dark:border-slate-800">Data we collect →</Link><Link to="/legal/terms" className="rounded-xl border border-ink-100 p-3 text-xs font-bold hover:border-brand-400 dark:border-slate-800">Terms of service →</Link><Link to="/legal/data" className="rounded-xl border border-ink-100 p-3 text-xs font-bold hover:border-brand-400 dark:border-slate-800">Data deletion policy →</Link></div></Card>
      </div>
    </div>
    <Modal open={editing} onClose={() => setEditing(false)} title="Edit profile"><div className="space-y-3"><Field label="Full name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Language level"><Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => <option key={l}>{l}</option>)}</Select></Field><Field label="Photo URL" hint="Paste an image link. Leave blank to keep your initials."><Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="https://…" /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={save} disabled={busy}>Save changes</Button></div></div></Modal>
    <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Link a child"><div className="space-y-3"><Field label="Invite code" hint="Ask your tutor for the student's invite code, e.g. LINK-DEMO-01."><Input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="LINK-DEMO-01" /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setLinkOpen(false)}>Cancel</Button><Button onClick={link} disabled={!invite}>Link account</Button></div></div></Modal>
    <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Request account deletion"><div className="space-y-3"><p className="text-sm text-ink-500">Your request is recorded immediately. An administrator reviews and anonymises the account within 30 days. You can export your data first.</p><Field label="Reason (optional)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" onClick={requestDeletion}>Submit request</Button></div></div></Modal>
  </>;
}
