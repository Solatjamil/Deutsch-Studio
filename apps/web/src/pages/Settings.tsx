import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Globe2, Info, Mail, Moon, Phone, ShieldCheck, Sun } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useApi, Badge, Button, Card, PageHeader, SectionTitle, useToast } from '../components/ui';

export default function Settings() {
  const { lang, setLang } = useI18n();
  const { institute } = useAuth();
  const toast = useToast();
  const [dark, setDark] = useState(localStorage.getItem('ds-theme') === 'dark');
  const { data: prefs, setData: setPrefs } = useApi<Record<string, boolean>>('/notifications/prefs');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('ds-theme', dark ? 'dark' : 'light'); }, [dark]);
  const toggle = async (cat: string, value: boolean) => {
    const next = { ...(prefs || {}), [cat]: value }; setPrefs(next);
    try { await api.put('/notifications/prefs', { prefs: { [cat]: value } }); } catch (e: any) { toast(e.message, 'error'); }
  };
  return <>
    <PageHeader title="Settings" subtitle="Make the app work the way you like." />
    <div className="grid gap-5 lg:grid-cols-2">
      <Card><SectionTitle title="Language" /><p className="mb-3 text-xs text-ink-500">The interface is ready for English and Hindi.</p><div className="flex gap-2">{[{ id: 'en', label: 'English' }, { id: 'hi', label: 'हिन्दी' }].map((l) => <button key={l.id} onClick={() => setLang(l.id)} className={`flex-1 rounded-xl border p-3 text-sm font-bold ${lang === l.id ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : 'border-slate-200 dark:border-slate-700'}`}>{l.label}</button>)}</div>
        <div className="mt-5 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800">{dark ? <Moon size={17} /> : <Sun size={17} />}</span><div><p className="text-sm font-bold">Dark theme</p><p className="text-[11px] text-ink-500">Easier on the eyes at night</p></div></div><button role="switch" aria-checked={dark} onClick={() => setDark(!dark)} className={`relative h-6 w-11 rounded-full transition ${dark ? 'bg-brand-600' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${dark ? 'left-5.5' : 'left-0.5'}`} /></button></div>
      </Card>
      <Card><SectionTitle title="Notifications" /><div className="space-y-2">{Object.entries(prefs || {}).map(([cat, on]) => <label key={cat} className="flex items-center justify-between rounded-xl bg-ink-50 p-3 text-xs font-semibold capitalize dark:bg-slate-800"><span className="inline-flex items-center gap-2"><Bell size={14} className="text-brand-600" />{cat}</span><input type="checkbox" checked={!!on} onChange={(e) => toggle(cat, e.target.checked)} className="h-5 w-5 accent-[#1f6f5c]" /></label>)}</div></Card>
      <Card><SectionTitle title="Legal & privacy" /><div className="space-y-2">{[['privacy', 'Privacy Policy', ShieldCheck], ['terms', 'Terms of Service', Info], ['data', 'Data we collect & deletion', Globe2]].map(([slug, label, Icon]: any) => <Link key={String(slug)} to={`/app/legal/${slug}`} className="flex items-center justify-between rounded-xl border border-ink-100 p-3 text-sm font-semibold hover:border-brand-400 dark:border-slate-800"><span className="inline-flex items-center gap-2"><Icon size={15} className="text-brand-600" />{label}</span><span>→</span></Link>)}</div></Card>
      <Card><SectionTitle title="About" /><div className="space-y-2 text-xs text-ink-500 dark:text-slate-400"><p><strong className="text-ink-900 dark:text-white">{institute?.name || 'Deutsch Studio'}</strong> · {institute?.tagline}</p><p className="flex items-center gap-2"><Mail size={14} /> {institute?.contact?.email || 'hello@deutschstudio.demo'}</p><p className="flex items-center gap-2"><Phone size={14} /> {institute?.contact?.phone || '+92 300 1234567'}</p><p>App version 1.0.0 · Demo build</p><div className="pt-2"><Badge tone="green">All systems operational</Badge></div></div></Card>
    </div>
  </>;
}
