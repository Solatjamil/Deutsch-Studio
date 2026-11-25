import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  Bell, BookOpen, CalendarDays, ChartNoAxesColumn, MessageCircle, ClipboardCheck,
  GraduationCap, Home, LayoutDashboard, Library, LogOut, Menu, Moon, ReceiptText, Settings,
  Sun, UsersRound, WifiOff, X, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { scheduleClassReminders } from '../lib/notifications';
import { Avatar, Badge, Modal } from './ui';

type NavItem = { to: string; label: string; icon: any; roles?: string[]; end?: boolean };
const NAV: NavItem[] = [
  { to: '/app', label: 'home', icon: Home, end: true },
  { to: '/app/classes', label: 'classes', icon: CalendarDays },
  { to: '/app/courses', label: 'courses', icon: BookOpen },
  { to: '/app/homework', label: 'homework', icon: ClipboardCheck },
  { to: '/app/attendance', label: 'attendance', icon: ChartNoAxesColumn, roles: ['student', 'parent', 'tutor', 'admin'] },
  { to: '/app/fees', label: 'fees', icon: ReceiptText },
  { to: '/app/reports', label: 'reports', icon: ChartNoAxesColumn },
  { to: '/app/materials', label: 'materials', icon: Library },
  { to: '/app/tests', label: 'Tests', icon: ClipboardCheck, roles: ['student', 'tutor', 'admin'] },
  { to: '/app/announcements', label: 'announcements', icon: Bell },
  { to: '/app/chat', label: 'chat', icon: MessageCircle },
  { to: '/app/admin', label: 'admin', icon: LayoutDashboard, roles: ['admin', 'tutor'] },
  { to: '/app/notifications', label: 'notifications', icon: Bell },
  { to: '/app/settings', label: 'settings', icon: Settings },
  { to: '/app/profile', label: 'profile', icon: UsersRound },
];

const PRIMARY: Record<string, string[]> = {
  student: ['/app', '/app/classes', '/app/homework', '/app/chat', '/app/profile'],
  parent: ['/app', '/app/classes', '/app/homework', '/app/fees', '/app/profile'],
  tutor: ['/app', '/app/classes', '/app/homework', '/app/attendance', '/app/admin'],
  admin: ['/app', '/app/classes', '/app/homework', '/app/attendance', '/app/admin'],
};

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-2.5">
    <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
      <GraduationCap size={20} strokeWidth={2.2} />
    </div>
    {!compact && <div className="leading-tight"><p className="text-sm font-extrabold tracking-tight text-ink-900 dark:text-white">Deutsch Studio</p><p className="text-[10px] font-medium text-brand-600 dark:text-brand-300">German, made clear.</p></div>}
  </div>;
}

export default function Layout() {
  const { user, children, institute, switchRole } = useAuth();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dark, setDark] = useState(localStorage.getItem('ds-theme') === 'dark');
  const [unread, setUnread] = useState(0);
  const [childId, setChildId] = useState<string>(() => localStorage.getItem('ds-child') || '');
  const [childOpen, setChildOpen] = useState(false);

  const role = user?.role || 'student';
  const items = NAV.filter((n) => !n.roles || n.roles.includes(role));
  const primaryIds = PRIMARY[role] || PRIMARY.student;
  const bottomItems = primaryIds.map((id) => items.find((i) => i.to === id)).filter(Boolean) as NavItem[];

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const meta = document.querySelector('meta[name="robots"]') || document.createElement('meta');
    meta.setAttribute('name', 'robots'); meta.setAttribute('content', 'noindex, nofollow');
    document.head.appendChild(meta);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); meta.remove(); };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('ds-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    api.get('/notifications').then((list: any[]) => setUnread(list.filter((n) => !n.read_at).length)).catch(() => {});
    api.get('/schedule').then((sessions: any[]) => scheduleClassReminders(sessions)).catch(() => {});
  }, [location.pathname]);

  const activeChild = children.find((c: any) => String(c.id) === childId) || children[0];

  const navItem = (item: NavItem, mobile = false) => {
    const Icon = item.icon;
    const base = mobile
      ? 'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold'
      : 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium';
    return <NavLink key={item.to} to={item.to} end={item.to === '/app'}
      className={({ isActive }) => clsx(base,
        isActive
          ? (mobile ? 'text-brand-700 dark:text-brand-300' : 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200')
          : (mobile ? 'text-ink-500 dark:text-slate-400' : 'text-ink-500 hover:bg-slate-50 hover:text-ink-900 dark:text-slate-400 dark:hover:bg-slate-800'))}>
      {({ isActive }: any) => <><span className="relative"><Icon size={mobile ? 20 : 18} strokeWidth={isActive ? 2.4 : 1.9} />{item.label === 'notifications' && unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] text-white">{unread}</span>}</span>
        <span>{t(item.label)}</span></>}
    </NavLink>;
  };

  if (!user) return null;

  return <div className="min-h-screen bg-[#f7f8f5] text-ink-900 dark:bg-[#0d1614] dark:text-slate-100">
    {!online && <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950"><WifiOff size={14} />{t('offline')}</div>}

    {/* Desktop sidebar */}
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-100 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900 lg:flex">
      <div className="px-2"><Logo /></div>
      <div className="mt-8 flex-1 space-y-1 overflow-y-auto">{items.map((i) => navItem(i))}</div>
      <div className="rounded-xl2 bg-brand-50 p-3 dark:bg-brand-900/30">
        <p className="text-xs font-bold text-brand-800 dark:text-brand-200">{institute?.name || 'Deutsch Studio'}</p>
        <p className="mt-0.5 text-[11px] text-brand-700/70 dark:text-brand-300/70">Version 1.0 · Demo build</p>
      </div>
    </aside>

    <div className="lg:pl-64">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-ink-100 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-6">
        <div className="flex items-center gap-3"><div className="lg:hidden"><Logo compact /></div>
          <div className="hidden lg:block"><p className="text-xs text-ink-500 dark:text-slate-400">{role === 'parent' ? 'Parent view' : role === 'tutor' ? 'Tutor console' : role === 'admin' ? 'Admin console' : 'Student space'}</p></div>
          {role === 'parent' && children.length > 0 && <div className="relative">
            <button onClick={() => setChildOpen(!childOpen)} className="flex items-center gap-2 rounded-full bg-brand-50 py-1 pl-1 pr-2.5 text-xs font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">
              <Avatar name={activeChild?.name || 'Child'} size={26} />{activeChild?.name?.split(' ')[0]} <ChevronDown size={13} />
            </button>
            {childOpen && <div className="absolute left-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {children.map((c: any) => <button key={c.id} onClick={() => { localStorage.setItem('ds-child', String(c.id)); setChildId(String(c.id)); setChildOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><Avatar name={c.name} size={26} />{c.name}</button>)}
            </div>}
          </div>}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <select value={role} aria-label="Switch demo role" title="Switch demo role" onChange={async (e) => { await switchRole(e.target.value); navigate('/app'); }} className="h-9 w-[88px] rounded-lg border border-slate-200 bg-white px-1.5 text-[11px] font-bold text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-300 sm:w-auto sm:px-2.5 sm:text-xs">
            <option value="student">Student</option><option value="parent">Parent</option><option value="tutor">Tutor</option><option value="admin">Admin</option>
          </select>
          <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label="Switch language" className="hidden rounded-lg px-2 py-2 text-xs font-bold text-ink-500 hover:bg-slate-100 sm:block dark:text-slate-300 dark:hover:bg-slate-800">{lang === 'en' ? 'हिं' : 'EN'}</button>
          <button onClick={() => setDark(!dark)} aria-label="Toggle dark mode" className="hidden rounded-lg p-2 text-ink-500 hover:bg-slate-100 sm:block dark:text-slate-300 dark:hover:bg-slate-800">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button onClick={() => navigate('/app/notifications')} aria-label="Notifications" className="relative hidden rounded-lg p-2 text-ink-500 hover:bg-slate-100 sm:block dark:text-slate-300 dark:hover:bg-slate-800"><Bell size={18} />{unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}</button>
          <NavLink to="/app/profile" className="ml-1 hidden sm:block"><Avatar name={user.name} size={34} /></NavLink>
          <button onClick={() => setMoreOpen(true)} aria-label="More menu" className="rounded-lg p-2 text-ink-500 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"><Menu size={20} /></button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12"><Outlet /></main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden" aria-label="Primary navigation">
        {bottomItems.map((i) => navItem(i, true))}
      </nav>
    </div>

    <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="All sections">
      <div className="grid grid-cols-2 gap-2">
        {items.map((i) => <NavLink key={i.to} to={i.to} onClick={() => setMoreOpen(false)} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium dark:border-slate-700"><i.icon size={17} className="text-brand-600" />{t(i.label)}</NavLink>)}
      </div>
    </Modal>
  </div>;
}
