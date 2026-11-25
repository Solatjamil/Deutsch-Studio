import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Brain, Download, FileAudio, FileText, Headphones, Search, Sparkles, Volume2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApi, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, SectionTitle, useToast } from '../components/ui';

const typeIcon: Record<string, any> = { pdf: FileText, vocab: BookTextIcon, grammar: Brain, audio: FileAudio, ebook: FileText };
function BookTextIcon(props: any) { return <FileText {...props} />; }

export default function Materials() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [type, setType] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const { data, error, loading, reload } = useApi<any[]>(`/materials?${query ? `q=${encodeURIComponent(query)}&` : ''}${level !== 'all' ? `level=${level}&` : ''}${type !== 'all' ? `type=${type}&` : ''}${favOnly ? 'favorite=true' : ''}`, [query, level, type, favOnly]);
  const { data: cards } = useApi<any[]>('/practice/flashcards');
  const { data: dailyWord } = useApi<any>('/practice/word');
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => data || [], [data]);
  const toggleFav = async (m: any) => {
    try { const res = await api.post(`/materials/${m.id}/favorite`); toast(res.favorite ? 'Added to favourites.' : 'Removed from favourites.'); reload(); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  const cacheOffline = async (m: any) => {
    try { const cache = await caches.open('deutsch-materials'); await cache.add(m.url); toast('Saved for offline reading.'); }
    catch { toast('Offline caching is not available in this browser.', 'error'); }
  };
  const review = async (correct: boolean) => {
    const card = cards?.[cardIndex];
    if (card) { try { await api.post(`/practice/flashcards/${card.id}`, { correct }); } catch { /* non-critical */ } }
    setFlipped(false); setCardIndex((cardIndex + 1) % Math.max(1, cards?.length || 1));
  };
  const submitQuiz = async () => {
    setBusy(true);
    try { setResult(await api.post('/practice/quiz', { answers })); }
    catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  if (error) return <ErrorBox error={error} retry={reload} />;
  return <>
    <PageHeader title="Study material" subtitle="Vocabulary, grammar, audio and exam practice — organised by level." action={<Button size="sm" variant="outline" onClick={() => setQuizOpen(true)}><Sparkles size={15} /> Daily grammar quiz</Button>} />
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card className="!p-4"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title or topic" className="pl-9" aria-label="Search materials" /></div><select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="all">All levels</option>{['A1', 'A2', 'B1', 'B2', 'C1'].map((l) => <option key={l}>{l}</option>)}</select><select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="all">All types</option>{['pdf', 'vocab', 'grammar', 'audio', 'ebook'].map((t) => <option key={t}>{t}</option>)}</select><Button variant={favOnly ? 'primary' : 'outline'} onClick={() => setFavOnly(!favOnly)} aria-label="Favourites only">{favOnly ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}</Button></div></Card>
        {loading && !data ? <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <Card key={i}><div className="h-16 animate-pulse rounded bg-slate-200" /></Card>)}</div>
          : list.length ? <div className="grid gap-3 sm:grid-cols-2">{list.map((m) => { const Icon = typeIcon[m.type] || FileText; return <Card key={m.id} className="!p-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30">{m.type === 'audio' ? <Headphones size={19} /> : <Icon size={19} />}</span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">{m.title}</h3><div className="mt-1 flex flex-wrap gap-1"><Badge tone="slate">{m.level}</Badge><Badge tone="blue">{m.type}</Badge></div><p className="mt-2 text-[11px] text-ink-500">{m.topic} · {m.size_kb} KB</p></div><button onClick={() => toggleFav(m)} aria-label="Toggle favourite" className="text-brand-600">{m.favorite ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button></div>
            <div className="mt-3 flex gap-2"><a href={m.url} target="_blank" rel="noreferrer" className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 text-xs font-bold text-white hover:bg-brand-700"><FileText size={13} /> Open</a><button onClick={() => cacheOffline(m)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold dark:border-slate-700"><Download size={13} /> Offline</button></div>
          </Card>; })}</div> : <EmptyState icon={Search} title="No material found" description="Try a different search, level or type." />}
      </div>
      <div className="space-y-5">
        <Card className="bg-sand-50 dark:bg-slate-900"><SectionTitle title="Daily word" action={<Volume2 size={16} className="text-brand-600" />} />
          {dailyWord ? <><p className="text-2xl font-extrabold text-ink-900 dark:text-white">{dailyWord.front}</p><p className="mt-1 text-sm text-ink-500 dark:text-slate-400">{dailyWord.back}</p><Badge tone="slate" className="mt-3">{dailyWord.topic}</Badge></> : <p className="text-sm text-ink-500">Loading…</p>}
        </Card>
        <Card><SectionTitle title="Flashcards" action={<span className="text-[10px] text-ink-500">{cardIndex + 1}/{cards?.length || 0}</span>} />
          {cards?.length ? <><button onClick={() => setFlipped(!flipped)} className="flex h-36 w-full flex-col items-center justify-center rounded-xl2 border border-brand-200 bg-brand-50 p-4 text-center transition dark:border-brand-800 dark:bg-brand-900/30"><p className="text-xl font-extrabold">{flipped ? cards[cardIndex].back : cards[cardIndex].front}</p><p className="mt-2 text-[10px] uppercase tracking-wide text-ink-500">Tap to {flipped ? 'see word' : 'reveal meaning'}</p></button>
            <div className="mt-3 flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => review(false)}>Again</Button><Button size="sm" className="flex-1" onClick={() => review(true)}>Got it</Button></div></> : <p className="text-sm text-ink-500">No flashcards for your level yet.</p>}
        </Card>
        <Card><h2 className="text-sm font-extrabold">Practice tips</h2><ul className="mt-2 space-y-2 text-xs text-ink-500 dark:text-slate-400"><li>• Review five flashcards every day.</li><li>• Listen to audio material twice: once for gist, once for detail.</li><li>• Save new words with an example sentence.</li></ul></Card>
      </div>
    </div>
    <Modal open={quizOpen} onClose={() => { setQuizOpen(false); setResult(null); }} title="Daily grammar quiz">
      {result ? <div className="py-6 text-center"><p className="text-4xl font-extrabold text-brand-700 dark:text-brand-300">{result.score}/{result.total}</p><p className="mt-2 text-sm text-ink-500">Nice practice! Try again tomorrow.</p><Button className="mt-4" onClick={() => { setResult(null); setAnswers({}); }}>Try again</Button></div>
        : <div className="space-y-4">{['Hello', 'Thank you', 'Good morning', 'To be (I)', 'Please'].map((q, i) => <Field key={q} label={`${i + 1}. What is “${q}” in German?`}><Input value={answers[String(i)] || ''} onChange={(e) => setAnswers({ ...answers, [String(i)]: e.target.value })} placeholder="Type the German word" /></Field>)}
          <Button className="w-full" onClick={submitQuiz} disabled={busy}>{busy ? 'Checking…' : 'Check answers'}</Button></div>}
    </Modal>
  </>;
}
