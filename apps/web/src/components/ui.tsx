import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, HTMLAttributes } from 'react';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { api } from '../lib/api';
import { initials, tone as toneOf } from '../lib/utils';

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'; size?: 'sm' | 'md' | 'lg' }) {
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300',
    secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-200',
    ghost: 'text-ink-700 hover:bg-ink-100 dark:text-slate-200 dark:hover:bg-slate-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-slate-200 bg-white text-ink-700 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  };
  const sizes = { sm: 'h-9 px-3 text-xs', md: 'h-11 px-4 text-sm', lg: 'h-12 px-5 text-sm' };
  return <button {...props} className={clsx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed', styles[variant], sizes[size], className)}>{children}</button>;
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={clsx('rounded-xl2 border border-ink-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900', className)}>{children}</div>;
}

export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  const t = tone || toneOf(String(children));
  const map: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
    red: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  };
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset', map[t] || map.slate, className)}>{children}</span>;
}

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
 	return src && !broken
    ? <img src={src} alt={name} onError={() => setBroken(true)} style={{ width: size, height: size }} className={clsx('rounded-full object-cover ring-2 ring-white dark:ring-slate-800', className)} />
    : <span style={{ width: size, height: size, fontSize: size * 0.36 }} className={clsx('inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-200', className)}>{initials(name)}</span>;
}

export function Progress({ value, color = 'bg-brand-600', className }: { value?: number; color?: string; className?: string }) {
  return <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800', className)} role="progressbar" aria-valuenow={value || 0} aria-valuemin={0} aria-valuemax={100}>
    <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }} />
  </div>;
}

export function PageHeader({ title, subtitle, action, back }: { title: string; subtitle?: string; action?: any; back?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div className="flex items-start gap-3">{back}<div><h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-2xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-slate-400">{subtitle}</p>}</div></div>
    {action}
  </div>;
}

export function SectionTitle({ title, action, className }: { title: string; action?: any; className?: string }) {
  return <div className={clsx('mb-3 flex items-center justify-between gap-2', className)}><h2 className="text-sm font-bold text-ink-900 dark:text-white sm:text-base">{title}</h2>{action}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon?: any; title: string; description?: string; action?: any }) {
  const isComponent = typeof icon === 'function' || !!(icon && typeof icon === 'object' && (icon as any).$$typeof && (icon as any).render);
  const Icon: any = isComponent ? icon : null;
  return <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/40">{Icon ? <Icon size={22} /> : icon || <AlertCircle size={22} />}</div>
    <p className="font-semibold text-ink-900 dark:text-white">{title}</p>
    {description && <p className="mt-1 max-w-xs text-sm text-ink-500 dark:text-slate-400">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800', className)} />;
}

export function ErrorBox({ error, retry }: { error: any; retry?: () => void }) {
  return <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
    <AlertCircle size={18} className="shrink-0" /><span className="flex-1">{error?.message || 'Something went wrong.'}</span>
    {retry && <button onClick={retry} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={14} /> Retry</button>}
  </div>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
    <div className={clsx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
      <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-ink-900 dark:text-white">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button></div>
      {children}
    </div>
  </div>;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={clsx('block', className)}><span className="mb-1.5 block text-xs font-semibold text-ink-700 dark:text-slate-300">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-ink-500 dark:text-slate-400">{hint}</span>}</label>;
}

export const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-ink-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-brand-900';
export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={clsx(inputClass, props.className)} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={clsx(inputClass, props.className)} />; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={clsx(inputClass, 'h-auto min-h-24 py-2.5', props.className)} />; }

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; badge?: number }[]; value: string; onChange: (id: string) => void }) {
  return <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
    {tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={clsx('whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition', value === t.id ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300' : 'text-ink-500 dark:text-slate-400')}>
      {t.label}{t.badge !== undefined && t.badge > 0 && <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">{t.badge}</span>}
    </button>)}
  </div>;
}

export function useApi<T = any>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<any>(null);
  const key = JSON.stringify(deps);
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true); setError(null);
    try { setData(await api.get(path)); }
    catch (e: any) { setError(e); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);
  useEffect(() => { load(); }, [load]);
  return { data, setData, loading, error, reload: load };
}

// ── Toasts ────────────────────────────────────────────────────────────────────
const ToastCtx = createContext<(msg: string, kind?: 'success' | 'error') => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const idRef = useRef(0);
  const toast = useCallback((msg: string, kind: 'success' | 'error' = 'success') => {
    const id = ++idRef.current;
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4000);
  }, []);
  return <ToastCtx.Provider value={toast}>{children}
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 sm:bottom-6">
      {items.map((i) => <div key={i.id} className={clsx('pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg', i.kind === 'error' ? 'bg-red-600' : 'bg-ink-900 dark:bg-slate-700')}>
        {i.kind === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}{i.msg}
      </div>)}
    </div>
  </ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);
