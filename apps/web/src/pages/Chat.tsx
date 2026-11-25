import { useEffect, useRef, useState } from 'react';
import { Ban, BellOff, Flag, Image, Mic, Paperclip, Send, ShieldCheck, UsersRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi, Avatar, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, Modal, Textarea, useToast } from '../components/ui';
import { relative } from '../lib/utils';

export default function Chat() {
  const { user, isStaff } = useAuth();
  const toast = useToast();
  const { data: rooms, error, reload: reloadRooms } = useApi<any[]>('/chat/rooms');
  const [roomId, setRoomId] = useState<number | null>(null);
  const { data: messages, setData: setMessages, reload } = useApi<any[]>(roomId ? `/chat/rooms/${roomId}/messages` : null, [roomId]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState('');
  const socket = useRef<WebSocket | null>(null);
  const messagesRef = useRef<any[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<any>(null);
  const [reportReason, setReportReason] = useState('');
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockId, setBlockId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (rooms?.length && !roomId) setRoomId(rooms[0].id); }, [rooms, roomId]);
  useEffect(() => { messagesRef.current = messages || []; }, [messages]);

  useEffect(() => {
    if (!roomId) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/ws?room=${roomId}`);
    socket.current = ws;
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'message' && data.roomId === roomId) setMessages((prev) => (prev || []).some((m) => m.id === data.message.id) ? prev : [...(prev || []), data.message]);
        if (data.event === 'typing') { setTyping(data.typing ? `${data.name} is typing…` : ''); }
      } catch { /* ignore */ }
    };
    return () => { ws.close(); socket.current = null; };
  }, [roomId, setMessages]);

  // Serverless fallback: REST polling whenever the realtime socket is absent
  // (Vercel has no persistent WebSocket server). No extra config required.
  useEffect(() => {
    if (!roomId) return;
    let active = true;
    const timer = window.setInterval(async () => {
      if (!active || document.visibilityState !== 'visible') return;
      if (socket.current?.readyState === WebSocket.OPEN) return;
      try {
        const lastId = messagesRef.current.reduce((max, m) => Math.max(max, Number(m.id) || 0), 0);
        const fresh = await api.get(`/chat/rooms/${roomId}/messages?after=${lastId}`);
        if (!active || !Array.isArray(fresh) || !fresh.length) return;
        setMessages((prev) => {
          const seen = new Set((prev || []).map((m) => m.id));
          const additions = fresh.filter((m) => !seen.has(m.id));
          return additions.length ? [...(prev || []), ...additions] : prev;
        });
      } catch { /* polling is best-effort */ }
    }, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [roomId, setMessages]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages?.length]);

  const send = async () => {
    if (!text.trim() || !roomId) return;
    const body = text; setText('');
    try {
      const msg = await api.post(`/chat/rooms/${roomId}/messages`, { type: 'text', body });
      setMessages((prev) => (prev || []).some((m) => m.id === msg.id) ? prev : [...(prev || []), msg]);
    } catch (err: any) { setText(body); toast(err.message, 'error'); }
  };
  const sendFile = async (file: File) => {
    if (!roomId) return;
    try {
      const form = new FormData(); form.append('files', file); form.append('purpose', 'chat');
      const res = await api.upload('/upload', form);
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'voice' : 'file';
      const msg = await api.post(`/chat/rooms/${roomId}/messages`, { type, body: file.name, fileUrl: res.files[0].url });
      setMessages((prev) => [...(prev || []), msg]);
      toast('Attachment sent.');
    } catch (err: any) { toast(err.message, 'error'); }
  };
  const submitReport = async () => {
    try { await api.post(`/chat/messages/${report.id}/report`, { reason: reportReason }); toast('Report sent to the moderation queue.'); setReport(null); setReportReason(''); }
    catch (err: any) { toast(err.message, 'error'); }
  };
  const mute = async () => {
    try { await api.post(`/chat/rooms/${roomId}/mute-me`, { minutes: 60 }); toast('Notifications muted for 1 hour.'); }
    catch (err: any) { toast(err.message, 'error'); }
  };
  const block = async () => {
    try { await api.post('/chat/block', { userId: Number(blockId) }); toast('User blocked.'); setBlockOpen(false); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  if (error) return <ErrorBox error={error} retry={reloadRooms} />;
  const room = rooms?.find((r) => r.id === roomId);

  return <>
    <div className="mb-4 flex items-center justify-between gap-3"><div><h1 className="text-xl font-extrabold sm:text-2xl">Class chat</h1><p className="text-xs text-ink-500 dark:text-slate-400">Display names only — phone numbers are never shown to classmates.</p></div><Badge tone="green"><ShieldCheck size={12} className="mr-1 inline" /> Private</Badge></div>
    <div className="grid h-[calc(100vh-13rem)] min-h-[520px] gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="hidden !p-0 overflow-hidden lg:block"><div className="border-b border-ink-100 p-4 dark:border-slate-800"><p className="text-xs font-bold uppercase tracking-wider text-ink-500">Conversations</p></div><div className="overflow-y-auto">{rooms?.map((r) => <button key={r.id} onClick={() => setRoomId(r.id)} className={`flex w-full items-center gap-3 border-b border-ink-50 p-4 text-left last:border-0 dark:border-slate-800 ${roomId === r.id ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-ink-50 dark:hover:bg-slate-800'}`}>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">{r.type === 'group' ? <UsersRound size={18} /> : <Avatar name={r.name} size={34} />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{r.name}</span><span className="text-[10px] text-ink-500">{r.members} members</span></span>{r.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[10px] text-white">{r.unread}</span>}
      </button>)}{!rooms?.length && <p className="p-4 text-xs text-ink-500">No conversations yet.</p>}</div></Card>

      <Card className="flex !p-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-ink-100 p-3 dark:border-slate-800"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30">{room?.type === 'group' ? <UsersRound size={17} /> : <Avatar name={room?.name || '?'} size={32} />}</span><div><p className="text-sm font-bold">{room?.name || 'Select a room'}</p><p className="text-[10px] text-ink-500">{room?.type === 'group' ? 'Batch group · display names only' : 'Direct conversation'}</p></div></div>
          <div className="flex gap-1"><button onClick={mute} title="Mute for 1 hour" className="rounded-lg p-2 text-ink-500 hover:bg-slate-100 dark:hover:bg-slate-800"><BellOff size={17} /></button><button onClick={() => setBlockOpen(true)} title="Block a user" className="rounded-lg p-2 text-ink-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Ban size={17} /></button></div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-ink-100 p-2 dark:border-slate-800 lg:hidden">{rooms?.map((r) => <button key={r.id} onClick={() => setRoomId(r.id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${roomId === r.id ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-500 dark:bg-slate-800'}`}>{r.name}</button>)}</div>
        <div className="flex-1 space-y-3 overflow-y-auto bg-[#fbfcfb] p-4 dark:bg-slate-950/40">
          {!messages?.length && <EmptyState icon={UsersRound} title="No messages yet" description="Say hello to your batch — everyone sees display names only." />}
          {messages?.map((m) => { const mine = m.sender.id === user?.id; return <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] sm:max-w-[70%] ${mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-ink-900 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700'} rounded-2xl px-3.5 py-2.5`}>
            <div className="mb-1 flex items-center gap-2"><span className={`text-[10px] font-bold ${mine ? 'text-brand-100' : 'text-brand-700 dark:text-brand-300'}`}>{mine ? 'You' : m.sender.name}{m.sender.role === 'tutor' && ' · Tutor'}</span><span className={`text-[9px] ${mine ? 'text-brand-100' : 'text-ink-500'}`}>{relative(m.created_at)}</span></div>
            {m.fileUrl && (m.type === 'image' ? <img src={m.fileUrl} alt={m.body || 'Image'} className="mb-1 max-h-52 rounded-lg" /> : <a href={m.fileUrl} target="_blank" className="mb-1 inline-flex items-center gap-1 underline"><Paperclip size={13} /> {m.body}</a>)}
            {m.type === 'voice' && m.fileUrl ? <audio controls src={m.fileUrl} className="max-w-full" /> : m.body && <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>}
            {!mine && <button onClick={() => { setReport(m); setReportReason(''); }} className="mt-1 text-[9px] underline opacity-60 hover:opacity-100">Report</button>}
          </div></div>; })}
          {typing && <p className="text-[11px] italic text-ink-500">{typing}</p>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-ink-100 p-3 dark:border-slate-800"><div className="flex items-end gap-2"><input ref={fileRef} type="file" className="hidden" accept="image/*,audio/*,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} title="Attach file" className="h-10 w-10 shrink-0 rounded-xl text-ink-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Paperclip size={19} /></button>
          <button onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'audio/*'; i.onchange = () => i.files?.[0] && sendFile(i.files[0]); i.click(); }} title="Voice note" className="h-10 w-10 shrink-0 rounded-xl text-ink-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Mic size={19} /></button>
          <Textarea rows={1} value={text} onChange={(e) => { setText(e.target.value); if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: 'typing', typing: !!e.target.value })); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Write a message…" className="min-h-10 max-h-28 flex-1 resize-none py-2.5" />
          <Button onClick={send} disabled={!text.trim()} className="!h-10 !w-10 !px-0" aria-label="Send"><Send size={17} /></Button>
        </div></div>
      </Card>
    </div>
    <Modal open={!!report} onClose={() => setReport(null)} title="Report message"><div className="space-y-3"><p className="text-xs text-ink-500">Reports are visible only to tutors and admins. The sender is not notified.</p><Field label="Reason"><Textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="What is the problem?" /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setReport(null)}>Cancel</Button><Button onClick={submitReport} disabled={reportReason.length < 3}>Send report</Button></div></div></Modal>
    <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Block a participant"><div className="space-y-3"><Field label="Participant user ID" hint="Find a user ID in the admin console. Blocking hides their messages from you."><Input type="number" value={blockId} onChange={(e) => setBlockId(e.target.value)} placeholder="e.g. 5" /></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setBlockOpen(false)}>Cancel</Button><Button onClick={block} disabled={!blockId}>Block</Button></div></div></Modal>
  </>;
}
