import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Send, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, Badge, Button, Card, ErrorBox, PageHeader } from '../components/ui';

export default function TestTake() {
  const { id } = useParams();
  const { user, isStaff } = useAuth();
  const { data, error, reload } = useApi<any>(`/tests/${id}`, [id]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.attempt?.answers) setAnswers(data.attempt.answers);
    if (data?.duration_min && !data?.attempt) setRemaining(data.duration_min * 60);
  }, [data?.id]);

  useEffect(() => {
    if (remaining === null) return;
    const timer = setInterval(() => setRemaining((r) => (r === null ? null : Math.max(0, r - 1))), 1000);
    return () => clearInterval(timer);
  }, [remaining !== null]);

  const submit = async () => {
    setBusy(true);
    try { setResult(await api.post(`/tests/${id}/attempt`, { answers })); reload(); }
    catch (e: any) { setResult({ error: e.message }); } finally { setBusy(false); }
  };

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Card><div className="h-64 animate-pulse rounded bg-slate-200/60" /></Card>;
  const attempted = data.attempt || result?.score !== undefined;
  const correctCount = data.questions?.filter((q: any) => data.attempt?.answers?.[String(q.id)] === q.correct_answer).length || 0;

  return <>
    <Link to="/app/tests" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500"><ArrowLeft size={14} /> All tests</Link>
    <PageHeader title={data.title} subtitle={`${data.batch_name} · ${data.questions.length} questions`} action={remaining !== null && !attempted ? <span className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600 dark:bg-red-500/10"><Clock size={15} /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span> : <Badge>{isStaff ? 'Tutor preview' : attempted ? 'Attempted' : 'Not attempted'}</Badge>} />
    {!isStaff && attempted && <Card className="mb-5 !p-4"><div className="flex flex-wrap items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-xl font-extrabold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{(result?.score ?? data.attempt?.score) || 0}</div><div><p className="text-sm font-bold">Your result</p><p className="text-xs text-ink-500">Auto-graded MCQ score out of {result?.maxScore || data.attempt?.max_score || data.questions.length * 2}. Review your answers below.</p></div></div></Card>}
    <div className="space-y-4">{data.questions.map((q: any, i: number) => {
      const chosen = answers[String(q.id)];
      const correct = q.correct_answer;
      return <Card key={q.id}><div className="flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-extrabold text-brand-700 dark:bg-brand-900/30">{i + 1}</span><div className="flex-1"><p className="text-sm font-bold">{q.prompt}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{q.options.map((opt: string) => {
        const isChosen = chosen === opt;
        const showCorrect = attempted && isStaff;
        return <button key={opt} disabled={attempted || isStaff} onClick={() => setAnswers({ ...answers, [String(q.id)]: opt })} className={`flex items-center gap-2 rounded-xl border p-3 text-left text-xs font-medium transition ${isChosen ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-200 hover:border-brand-300 dark:border-slate-700'} ${showCorrect && opt === correct ? '!border-emerald-500 !bg-emerald-50 dark:!bg-emerald-500/10' : ''}`}>
          <span className={`grid h-5 w-5 place-items-center rounded-full border ${isChosen ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>{isChosen ? '✓' : ''}</span>{opt}
          {showCorrect && opt === correct && <CheckCircle2 size={14} className="ml-auto text-emerald-600" />}
        </button>})}</div>
        {attempted && !isStaff && <p className={`mt-2 text-xs ${chosen === correct ? 'text-emerald-600' : 'text-red-600'}`}>{chosen === correct ? 'Correct' : <>Correct answer: <strong>{correct}</strong></>}</p>}
      </div></div></Card>;
    })}</div>
    {!isStaff && !attempted && <div className="mt-5 flex justify-end"><Button onClick={submit} disabled={busy || Object.keys(answers).length < data.questions.length}><Send size={15} /> {busy ? 'Grading…' : 'Submit test'}</Button></div>}
    {result?.error && <p className="mt-3 text-sm text-red-600">{result.error}</p>}
    {attempted && !isStaff && <p className="mt-4 text-center text-xs text-ink-500">You scored {result?.score ?? data.attempt?.score} out of {result?.maxScore ?? data.attempt?.max_score} · {correctCount} correct answers</p>}
  </>;
}
