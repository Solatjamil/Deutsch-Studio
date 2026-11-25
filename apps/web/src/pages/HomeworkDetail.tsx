import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, Mic, Paperclip, Play, Send, Square, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Textarea, useToast } from '../components/ui';
import { fmtDateTime, relative } from '../lib/utils';

export default function HomeworkDetail() {
  const { id } = useParams();
  const { user, isStaff } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<any>(`/homework/${id}`, [id]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [review, setReview] = useState<any>(null);
  const [reviewForm, setReviewForm] = useState({ marks: 8, comments: '', voiceFeedbackUrl: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data?.submissions?.[0]) setText(data.submissions[0].text || ''); }, [data?.id]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData(); form.append('files', file); form.append('purpose', 'homework');
      const res = await api.upload('/upload', form);
      return res.files[0] as { url: string; originalName: string };
    } finally { setUploading(false); }
  };
  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files || []);
    try { const uploaded = await Promise.all(chosen.map(uploadFile)); setFiles([...files, ...uploaded.map((u) => ({ name: u.originalName, url: u.url }))]); toast('Attachment uploaded.'); }
    catch (err: any) { toast(err.message, 'error'); }
  };
  const toggleRecording = async () => {
    if (recording) { recorder.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream); chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        const file = new File([blob], `speaking-${Date.now()}.webm`, { type: 'audio/webm' });
        try { const up = await uploadFile(file); setAudioUrl(up.url); toast('Voice note attached.'); }
        catch (err: any) { toast(err.message, 'error'); }
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start(); recorder.current = rec; setRecording(true);
    } catch { toast('Microphone access was denied.', 'error'); }
  };
  const submit = async () => {
    setBusy(true);
    try { await api.post(`/homework/${id}/submit`, { text, files, audioUrl }); toast('Homework submitted!'); reload(); }
    catch (err: any) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const saveReview = async () => {
    if (!review) return;
    setBusy(true);
    try { await api.post(`/submissions/${review.id}/review`, reviewForm); toast('Feedback shared with the student.'); setReview(null); reload(); }
    catch (err: any) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Card><div className="h-64 animate-pulse rounded bg-slate-200/60" /></Card>;

  const mySubmission = data.submissions?.find((s: any) => s.student_id === user?.id) || data.submissions?.[0];
  const canSubmit = user?.role === 'student' && mySubmission?.status !== 'reviewed';

  return <>
    <Link to="/app/homework" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-brand-700"><ArrowLeft size={14} /> All homework</Link>
    <PageHeader title={data.title} subtitle={`${data.batch_name} · Due ${fmtDateTime(data.due_at)}`} action={<Badge>{data.status || 'pending'}</Badge>} />
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card><h2 className="mb-2 text-sm font-extrabold">Instructions</h2><p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-500 dark:text-slate-300">{data.instructions}</p>
          <div className="mt-4 flex flex-wrap gap-2">{data.attachments?.map((a: any) => <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"><Paperclip size={13} /> {a.name}</a>)}</div>
        </Card>
        {canSubmit && <Card><h2 className="mb-3 text-sm font-extrabold">Your submission</h2>
          <div className="space-y-3"><Field label="Write your answer"><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your response here…" /></Field>
            <div><p className="mb-2 text-xs font-semibold text-ink-700 dark:text-slate-300">Attachments</p><label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold hover:border-brand-400 dark:border-slate-700"><Upload size={15} /> Choose files<input type="file" multiple className="hidden" onChange={onFiles} /></label>
              <div className="mt-2 flex flex-wrap gap-2">{files.map((f) => <span key={f.url} className="rounded-lg bg-ink-50 px-2 py-1 text-[11px] dark:bg-slate-800">{f.name}</span>)}</div></div>
            <div className="rounded-xl border border-ink-100 p-3 dark:border-slate-800"><div className="flex flex-wrap items-center gap-3"><Button variant={recording ? 'danger' : 'outline'} size="sm" onClick={toggleRecording}>{recording ? <><Square size={14} /> Stop recording</> : <><Mic size={14} /> Record voice note</>}</Button>{recording && <span className="flex items-center gap-1 text-xs text-red-600"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Recording…</span>}{audioUrl && <a href={audioUrl} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600"><Play size={13} /> Listen</a>}</div><p className="mt-2 text-[11px] text-ink-500">Speaking practice is important — use the microphone to upload a short audio answer.</p></div>
            <Button onClick={submit} disabled={busy || uploading || (!text && !files.length && !audioUrl)}><Send size={15} /> {uploading ? 'Uploading…' : 'Submit work'}</Button>
          </div>
        </Card>}

        {mySubmission && <Card><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-extrabold">{isStaff ? 'Student submissions' : 'Your submission'}</h2><Badge>{mySubmission.status}</Badge></div>
          {isStaff ? <div className="space-y-3">{data.submissions.map((s: any) => <div key={s.id} className="rounded-xl border border-ink-100 p-3 dark:border-slate-800"><div className="flex items-center justify-between"><p className="text-sm font-bold">{s.student_name}</p><div className="flex items-center gap-2"><Badge>{s.status}</Badge>{s.marks !== null && <span className="text-xs font-bold">{s.marks}/{data.max_marks}</span>}</div></div><p className="mt-1 line-clamp-2 text-xs text-ink-500">{s.text}</p><div className="mt-2 flex gap-2">{s.audio_url && <a href={s.audio_url} target="_blank" className="text-xs font-semibold text-brand-600">▶ Voice note</a>}{s.files?.map((f: any) => <a key={f.url} href={f.url} target="_blank" className="text-xs font-semibold text-brand-600">📎 {f.name}</a>)}</div><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => { setReview(s); setReviewForm({ marks: s.marks ?? 8, comments: s.comments || '', voiceFeedbackUrl: '' }); }}>Review</Button>{s.voice_feedback_url && <a href={s.voice_feedback_url} target="_blank" className="inline-flex items-center text-xs text-brand-600">Voice feedback</a>}</div></div>)}</div>
            : <div className="space-y-2 text-sm"><p className="whitespace-pre-wrap text-ink-500 dark:text-slate-300">{mySubmission.text}</p>{mySubmission.files?.map((f: any) => <a key={f.url} href={f.url} target="_blank" className="block text-brand-600">📎 {f.name}</a>)}{mySubmission.audio_url && <a href={mySubmission.audio_url} target="_blank" className="block text-brand-600">▶ Your voice note</a>}
              <p className="text-xs text-ink-500">Submitted {relative(mySubmission.submitted_at)}</p>
              {mySubmission.status === 'reviewed' && <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10"><p className="text-xs font-bold">Marks: {mySubmission.marks}/{data.max_marks}</p><p className="mt-1 text-xs">{mySubmission.comments}</p>{mySubmission.voice_feedback_url && <a href={mySubmission.voice_feedback_url} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Play size={12} /> Tutor voice feedback</a>}</div>}
            </div>}
        </Card>}
      </div>
      <div className="space-y-5"><Card><h2 className="mb-3 text-sm font-extrabold">Details</h2><dl className="space-y-2 text-xs"><div className="flex justify-between"><dt className="text-ink-500">Max marks</dt><dd className="font-bold">{data.max_marks}</dd></div><div className="flex justify-between"><dt className="text-ink-500">Due</dt><dd className="font-bold">{fmtDateTime(data.due_at)}</dd></div><div className="flex justify-between"><dt className="text-ink-500">Batch</dt><dd className="font-bold">{data.batch_name}</dd></div></dl></Card>
        <Card><h2 className="mb-2 text-sm font-extrabold">Tips</h2><ul className="space-y-2 text-xs text-ink-500 dark:text-slate-400"><li className="flex gap-2"><CheckCircle2 size={14} className="text-brand-600" /> Use vocabulary from the lesson in your answer.</li><li className="flex gap-2"><CheckCircle2 size={14} className="text-brand-600" /> Speaking practice: record more than one take if needed.</li><li className="flex gap-2"><CheckCircle2 size={14} className="text-brand-600" /> Check feedback after review and revise.</li></ul></Card></div>
    </div>
    <Modal open={!!review} onClose={() => setReview(null)} title={`Review ${review?.student_name || 'submission'}`}>
      <div className="space-y-3"><div className="rounded-xl bg-ink-50 p-3 text-xs dark:bg-slate-800">{review?.text}</div><Field label={`Marks (out of ${data.max_marks})`}><Input type="number" min={0} max={data.max_marks} value={reviewForm.marks} onChange={(e) => setReviewForm({ ...reviewForm, marks: Number(e.target.value) })} /></Field><Field label="Comments"><Textarea value={reviewForm.comments} onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })} placeholder="What went well? What to improve?" /></Field><Field label="Voice feedback URL (optional)" hint="Audio files uploaded through the material manager can be linked here."><Input value={reviewForm.voiceFeedbackUrl} onChange={(e) => setReviewForm({ ...reviewForm, voiceFeedbackUrl: e.target.value })} placeholder="/api/uploads/..." /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setReview(null)}>Cancel</Button><Button onClick={saveReview} disabled={busy}>Share feedback</Button></div></div>
    </Modal>
  </>;
}
