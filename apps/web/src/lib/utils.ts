export const fmtDate = (value?: string | null, opts?: Intl.DateTimeFormatOptions) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' });
};
export const fmtTime = (value?: string | null) => value ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDateTime = (value?: string | null) => value ? `${fmtDate(value, { day: 'numeric', month: 'short' })} · ${fmtTime(value)}` : '—';
export const money = (n?: number) => `PKR ${Number(n || 0).toLocaleString('en-PK')}`;
export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const pct = (n?: number) => `${Math.max(0, Math.min(100, Number(n || 0)))}%`;
export const tone = (status = '') => {
  const s = status.toLowerCase();
  if (['paid', 'present', 'reviewed', 'submitted', 'approved', 'success', 'active'].includes(s)) return 'green';
  if (['late', 'partial', 'pending', 'leave'].includes(s)) return 'amber';
  if (['absent', 'overdue', 'rejected', 'failed'].includes(s)) return 'red';
  return 'slate';
};
export const relative = (value?: string) => {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days}d ago` : fmtDate(value, { day: 'numeric', month: 'short' });
};
export const todayStr = () => new Date().toISOString().slice(0, 10);
