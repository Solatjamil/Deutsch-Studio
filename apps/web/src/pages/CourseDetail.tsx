import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, BookmarkCheck, CheckCircle2, ChevronDown, ChevronUp, Download, Gauge, Lock, Play, UsersRound } from 'lucide-react';
import { useApi, Badge, Button, Card, ErrorBox, PageHeader, Progress, Skeleton, useToast } from '../components/ui';
import { money } from '../lib/utils';

const VIDEO_KEY = (id: number) => `ds-video-${id}`;
const BOOKMARK_KEY = (id: number) => `ds-bookmarks-${id}`;

function VideoPlayer({ lesson }: { lesson: any }) {
  const ref = useRef<HTMLVideoElement>(null);
  const toast = useToast();
  const [speed, setSpeed] = useState(1);
  const [position, setPosition] = useState(0);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [watched, setWatched] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(VIDEO_KEY(lesson.id)) || 0);
    setPosition(saved);
    setBookmarks(JSON.parse(localStorage.getItem(BOOKMARK_KEY(lesson.id)) || '[]'));
    setWatched(localStorage.getItem(`ds-watched-${lesson.id}`) === '1');
    setOffline((JSON.parse(localStorage.getItem('ds-offline-lessons') || '[]') as number[]).includes(lesson.id));
  }, [lesson.id]);

  const onLoaded = () => { if (position > 5 && ref.current) ref.current.currentTime = position; };
  const onTime = () => {
    const t = ref.current?.currentTime || 0;
    setPosition(t);
    localStorage.setItem(VIDEO_KEY(lesson.id), String(t));
    if (ref.current?.duration && t / ref.current.duration > 0.9 && !watched) {
      setWatched(true); localStorage.setItem(`ds-watched-${lesson.id}`, '1');
    }
  };
  const toggleBookmark = () => {
    const t = Math.floor(ref.current?.currentTime || 0);
    const next = bookmarks.includes(t) ? bookmarks.filter((b) => b !== t) : [...bookmarks, t].sort((a, b) => a - b);
    setBookmarks(next); localStorage.setItem(BOOKMARK_KEY(lesson.id), JSON.stringify(next));
  };
  const toggleOffline = async () => {
    const key = 'ds-offline-lessons';
    const ids: number[] = JSON.parse(localStorage.getItem(key) || '[]');
    const next = offline ? ids.filter((i) => i !== lesson.id) : [...ids, lesson.id];
    localStorage.setItem(key, JSON.stringify(next)); setOffline(!offline);
    if (!offline) {
      try { const cache = await caches.open('deutsch-video-offline'); await cache.add(lesson.video_url); toast('Lesson queued for offline access.'); }
      catch { toast('Saved locally. Offline video depends on browser support.', 'error'); }
    } else toast('Removed from offline list.');
  };

  return <div>
    <div className="relative overflow-hidden rounded-xl2 bg-black">
      <video ref={ref} controls playsInline preload="metadata" className="aspect-video w-full" onLoadedMetadata={onLoaded} onTimeUpdate={onTime} src={lesson.video_url} aria-label={lesson.title} />
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"><Gauge size={15} className="ml-2 text-ink-500" />{[0.75, 1, 1.25, 1.5, 2].map((s) => <button key={s} onClick={() => { setSpeed(s); if (ref.current) ref.current.playbackRate = s; }} className={`rounded-lg px-2 py-1 text-xs font-bold ${speed === s ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900' : 'text-ink-500'}`}>{s}×</button>)}</div>
      <Button variant="outline" size="sm" onClick={toggleBookmark}>{bookmarks.includes(Math.floor(position)) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />} Bookmark</Button>
      <Button variant="outline" size="sm" onClick={toggleOffline}><Download size={15} /> {offline ? 'Saved offline' : 'Save offline'}</Button>
      <Button variant={watched ? 'secondary' : 'outline'} size="sm" onClick={() => { const v = !watched; setWatched(v); localStorage.setItem(`ds-watched-${lesson.id}`, v ? '1' : '0'); }}><CheckCircle2 size={15} /> {watched ? 'Watched' : 'Mark watched'}</Button>
    </div>
    {bookmarks.length > 0 && <div className="mt-3 flex flex-wrap gap-2"><span className="text-xs font-semibold text-ink-500">Bookmarks:</span>{bookmarks.map((b) => <button key={b} onClick={() => { if (ref.current) ref.current.currentTime = b; }} className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{Math.floor(b / 60)}:{String(b % 60).padStart(2, '0')}</button>)}</div>}
    <p className="mt-3 text-xs text-ink-500 dark:text-slate-400">{lesson.description || 'Watch, pause and take notes. Your position is saved automatically on this device.'}</p>
  </div>;
}

export default function CourseDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<any>(`/courses/${id}`, [id]);
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState<any>(null);

  useEffect(() => { if (data?.modules?.length) { setOpen(data.modules[0].id); setActive(data.modules[0].lessons[0]); } }, [data?.id]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!data) return null;

  return <>
    <div className="mb-5"><Link to="/app/courses" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-brand-700"><ArrowLeft size={14} /> All courses</Link>
      <PageHeader title={data.title} subtitle={data.description} action={<Badge tone="green">{pctText(data.progress)} complete</Badge>} />
    </div>
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-ink-100 p-5 dark:border-slate-800"><div className="flex flex-wrap items-center gap-2"><Badge tone="green">{data.code}</Badge><Badge tone="slate">{data.duration_weeks} weeks</Badge><Badge tone="slate">{data.lessons || 0} lessons</Badge></div>
            <p className="mt-3 text-sm text-ink-500 dark:text-slate-400">Tutor: <strong>{data.tutor_name}</strong> · {data.schedule_text}</p>
          </div>
          <div className="p-5">
            {active ? <><h2 className="mb-3 text-base font-extrabold">{active.title}</h2><VideoPlayer lesson={active} /></> : <div className="grid aspect-video place-items-center rounded-xl2 bg-brand-50 text-brand-700 dark:bg-brand-900/30"><div className="text-center"><Play size={34} className="mx-auto" /><p className="mt-2 text-sm font-semibold">Select a lesson to start</p></div></div>}
          </div>
        </Card>
        <Card className="mt-5"><h2 className="mb-4 text-base font-extrabold">Course content</h2>
          <div className="space-y-2">{data.modules.map((m: any, mi: number) => <div key={m.id} className="overflow-hidden rounded-xl border border-ink-100 dark:border-slate-800">
            <button onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full items-center justify-between p-4 text-left"><span><span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Module {mi + 1}</span><span className="block text-sm font-bold">{m.title}</span></span>{open === m.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
            {open === m.id && <div className="border-t border-ink-100 dark:border-slate-800">{m.lessons.map((l: any, li: number) => {
              const watched = localStorage.getItem(`ds-watched-${l.id}`) === '1';
              const pos = Number(localStorage.getItem(VIDEO_KEY(l.id)) || 0);
              return <button key={l.id} onClick={() => setActive(l)} className={`flex w-full items-center gap-3 border-b border-ink-50 p-3 text-left last:border-0 hover:bg-ink-50 dark:border-slate-800 dark:hover:bg-slate-800 ${active?.id === l.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${watched ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-white text-brand-600 dark:bg-slate-800'}`}>{watched ? <CheckCircle2 size={17} /> : <Play size={15} />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{l.title}</span><span className="text-[10px] text-ink-500">{l.duration_min} min · video lesson</span></span>
                {pos > 0 && !watched && <span className="text-[10px] font-semibold text-amber-600">resume</span>}
              </button>;
            })}</div>}
          </div>)}</div>
        </Card>
      </div>
      <div className="space-y-5">
        <Card><h2 className="mb-3 text-sm font-extrabold">Your progress</h2><Progress value={data.progress} /><p className="mt-2 text-xs text-ink-500">{data.progress}% of the course complete</p>
          <div className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-xs dark:border-slate-800"><div className="flex justify-between"><span className="text-ink-500">Modules</span><strong>{data.modules.length}</strong></div><div className="flex justify-between"><span className="text-ink-500">Video lessons</span><strong>{data.modules.reduce((s: number, m: any) => s + m.lessons.length, 0)}</strong></div><div className="flex justify-between"><span className="text-ink-500">Course fee</span><strong>{money(data.price)}</strong></div></div>
        </Card>
        <Card><h2 className="mb-3 text-sm font-extrabold">Syllabus</h2><div className="space-y-3">{(data.syllabus || []).map((s: any, i: number) => <div key={i}><p className="text-xs font-bold">{s.title}</p><div className="mt-1 flex flex-wrap gap-1">{(s.topics || []).map((t: string) => <span key={t} className="rounded-md bg-ink-50 px-2 py-1 text-[10px] text-ink-500 dark:bg-slate-800 dark:text-slate-300">{t}</span>)}</div></div>)}{!data.syllabus?.length && <p className="text-xs text-ink-500">Syllabus details coming soon.</p>}</div></Card>
        {data.batches?.length > 0 && <Card><h2 className="mb-3 text-sm font-extrabold">Open batches</h2>{data.batches.map((b: any) => <div key={b.id} className="flex items-center gap-2 rounded-xl bg-ink-50 p-3 text-xs dark:bg-slate-800"><UsersRound size={15} className="text-brand-600" /><span className="flex-1 font-semibold">{b.name}</span><Lock size={13} className="text-ink-500" /></div>)}</Card>}
      </div>
    </div>
  </>;
}
function pctText(n: number) { return `${n || 0}%`; }
