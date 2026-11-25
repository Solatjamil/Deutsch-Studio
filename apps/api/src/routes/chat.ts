import { Router } from 'express';
import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import { all, get, now, run } from '../db/index.js';
import { assertBatchAccess, assertRoomAccess, isStaff, requireAuth, requireRole, validate, asyncRoute } from '../middleware.js';
import { verifyAccessToken } from '../services/auth.js';

export const chatRouter = Router();

const roomsFor = async (user: any) => isStaff(user)
  ? (await all<any>(`SELECT c.*,(SELECT COUNT(*) FROM chat_members m WHERE m.room_id=c.id) members FROM chat_rooms c ORDER BY c.id`))
  : (await all<any>(`SELECT c.*,(SELECT COUNT(*) FROM chat_members m WHERE m.room_id=c.id) members FROM chat_rooms c JOIN chat_members m ON m.room_id=c.id WHERE m.user_id=? ORDER BY c.id`, user.id));

const messagePayload = (m: any) => ({
  id: m.id, roomId: m.room_id, type: m.type, body: m.body, fileUrl: m.file_url, createdAt: m.created_at,
  sender: { id: m.sender_id, name: m.sender_name, role: m.sender_role },
});

export const roomBroadcast: Record<number, Set<WebSocket>> = {};

chatRouter.get('/rooms', requireAuth, asyncRoute(async (req: any, res) => {
      res.json(await Promise.all((await roomsFor(req.user)).map(async (r) => ({ ...r, unread: (await get<{ n: number }>(`SELECT COUNT(*) n FROM chat_messages WHERE room_id=? AND sender_id!=? AND id > COALESCE((SELECT MAX(id) FROM chat_messages WHERE room_id=? AND sender_id=?),0)`, r.id, req.user.id, r.id, req.user.id))?.n || 0 }))));
    }));

chatRouter.get('/rooms/:id/messages', requireAuth, asyncRoute(async (req: any, res) => {
      (await assertRoomAccess(req.user, Number(req.params.id)));
      const before = Number(req.query.before || 0);
      const after = Number(req.query.after || 0);
      const where = ['m.room_id=?'];
      const params: any[] = [req.params.id];
      if (before) { where.push('m.id<?'); params.push(before); }
      if (after) { where.push('m.id>?'); params.push(after); }
      const ascending = !!after && !before;
      params.push(100);
      const rows = (await all<any>(`SELECT m.*,u.name sender_name,u.role sender_role FROM chat_messages m JOIN users u ON u.id=m.sender_id
    WHERE ${where.join(' AND ')} ORDER BY m.id ${ascending ? 'ASC' : 'DESC'} LIMIT ?`, ...params));
      res.json((ascending ? rows : rows.reverse()).map(messagePayload));
    }));

chatRouter.post('/rooms/:id/messages', requireAuth, validate(z.object({
  type: z.enum(['text', 'image', 'file', 'voice']).optional(),
  body: z.string().max(4000).optional(),
  fileUrl: z.string().max(500).optional(),
})), asyncRoute(async (req: any, res) => {
      const roomId = Number(req.params.id);
      (await assertRoomAccess(req.user, roomId));
      const mute = (await get<any>('SELECT * FROM chat_mutes WHERE room_id=? AND user_id=?', roomId, req.user.id));
      if (mute?.muted_until && new Date(mute.muted_until) > new Date()) return res.status(403).json({ error: 'You are muted in this group.' });
      const type = req.body.type || (req.body.fileUrl ? 'file' : 'text');
      if (!req.body.body && !req.body.fileUrl) return res.status(400).json({ error: 'Message is empty.' });
      if (req.body.fileUrl && !/^\/api\/(uploads|files\/demo)\//.test(req.body.fileUrl)) return res.status(400).json({ error: 'Invalid attachment.' });
      const info = (await run('INSERT INTO chat_messages (room_id,sender_id,type,body,file_url,created_at) VALUES (?,?,?,?,?,?)',
        roomId, req.user.id, type, req.body.body || null, req.body.fileUrl || null, now()));
      const msg = (await get<any>(`SELECT m.*,u.name sender_name,u.role sender_role FROM chat_messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?`, Number(info.lastInsertRowid)))!;
      const payload = JSON.stringify({ event: 'message', roomId, message: messagePayload(msg) });
      (roomBroadcast[roomId] || []).forEach((ws) => { if (ws.readyState === WebSocket.OPEN) ws.send(payload); });
      res.status(201).json(messagePayload(msg));
    }));

chatRouter.post('/rooms/:id/mute', requireAuth, requireRole('tutor', 'admin'), validate(z.object({ minutes: z.number().int().min(1).max(10080), userId: z.number().int() })), asyncRoute(async (req: any, res) => {
      (await assertRoomAccess(req.user, Number(req.params.id)));
      const until = new Date(Date.now() + req.body.minutes * 60000).toISOString();
      (await run('INSERT INTO chat_mutes (room_id,user_id,muted_until) VALUES (?,?,?) ON CONFLICT(room_id,user_id) DO UPDATE SET muted_until=excluded.muted_until',
        req.params.id, req.body.userId, until));
      res.json({ ok: true, until });
    }));

chatRouter.post('/rooms/:id/mute-me', requireAuth, validate(z.object({ minutes: z.number().int().min(1).max(10080) })), asyncRoute(async (req: any, res) => {
      const until = new Date(Date.now() + req.body.minutes * 60000).toISOString();
      (await run('INSERT INTO chat_mutes (room_id,user_id,muted_until) VALUES (?,?,?) ON CONFLICT(room_id,user_id) DO UPDATE SET muted_until=excluded.muted_until', req.params.id, req.user.id, until));
      res.json({ ok: true, until });
    }));

chatRouter.post('/messages/:id/report', requireAuth, validate(z.object({ reason: z.string().min(3).max(300) })), asyncRoute(async (req: any, res) => {
      const msg = (await get<any>('SELECT * FROM chat_messages WHERE id=?', req.params.id));
      if (!msg) return res.status(404).json({ error: 'Message not found' });
      (await assertRoomAccess(req.user, msg.room_id));
      (await run('INSERT INTO message_reports (message_id,reporter_id,reason,status,created_at) VALUES (?,?,?,?,?)', msg.id, req.user.id, req.body.reason, 'open', now()));
      res.json({ ok: true });
    }));

chatRouter.post('/block', requireAuth, validate(z.object({ userId: z.number().int() })), asyncRoute(async (req: any, res) => {
      if (req.body.userId === req.user.id) return res.status(400).json({ error: 'You cannot block yourself.' });
      (await run('INSERT OR IGNORE INTO chat_blocks (blocker_id,blocked_id,created_at) VALUES (?,?,?)', req.user.id, req.body.userId, now()));
      res.json({ ok: true });
    }));

chatRouter.get('/blocks', requireAuth, asyncRoute(async (req: any, res) => {
      res.json((await all<any>(`SELECT b.blocked_id id,u.name FROM chat_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=?`, req.user.id)));
    }));

chatRouter.get('/reports', requireAuth, requireRole('tutor', 'admin'), asyncRoute(async (_req, res) => {
      res.json((await all<any>(`SELECT r.*,u.name reporter_name,m.body FROM message_reports r JOIN users u ON u.id=r.reporter_id JOIN chat_messages m ON m.id=r.message_id ORDER BY r.created_at DESC`)));
    }));

chatRouter.post('/rooms', requireAuth, requireRole('tutor', 'admin'), validate(z.object({ name: z.string().min(2), batchId: z.number().int().optional(), memberIds: z.array(z.number().int()).min(1) })), asyncRoute(async (req: any, res) => {
      if (req.body.batchId) (await assertBatchAccess(req.user, req.body.batchId));
      const info = (await run('INSERT INTO chat_rooms (name,type,batch_id,created_at) VALUES (?,?,?,?)', req.body.name, req.body.batchId ? 'group' : 'direct', req.body.batchId || null, now()));
      const roomId = Number(info.lastInsertRowid);
      await Promise.all([...req.body.memberIds, req.user.id].map(async (id) => (await run('INSERT OR IGNORE INTO chat_members (room_id,user_id) VALUES (?,?)', roomId, id))));
      res.status(201).json({ id: roomId });
    }));

/** WebSocket transport for realtime chat. Auth uses the same httpOnly cookies as REST. */
export async function attachChatWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://localhost');
    if (url.pathname !== '/api/ws') return;
    const cookies = Object.fromEntries((request.headers.cookie || '').split(';').map((c) => c.trim().split('=').map(decodeURIComponent)));
    const user = verifyAccessToken(cookies.ds_access);
    const roomId = Number(url.searchParams.get('room'));
    try {
      if (!user) throw new Error('Unauthorized');
      (await assertRoomAccess(user, roomId));
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, { user, roomId }));
    } catch {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy();
    }
  });
  wss.on('connection', (ws: WebSocket, ctx: any) => {
    (roomBroadcast[ctx.roomId] ||= new Set()).add(ws);
    ws.on('close', () => roomBroadcast[ctx.roomId]?.delete(ws));
    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(String(raw));
        if (data.type === 'typing') {
          const payload = JSON.stringify({ event: 'typing', roomId: ctx.roomId, name: ctx.user.name, typing: !!data.typing });
          (roomBroadcast[ctx.roomId] || []).forEach((c) => { if (c !== ws && c.readyState === WebSocket.OPEN) c.send(payload); });
        }
      } catch { /* ignore malformed frames */ }
    });
  });
  return wss;
}
