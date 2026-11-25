import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { all, db, get, now, run } from '../db/index.js';
import { asyncRoute, requireAuth, validate } from '../middleware.js';
import {
  checkPassword, createOtp, hashPassword, issueTokens, publicUser,
  revokeRefresh, smsProvider, verifyAccessToken, verifyOtp, verifyRefreshToken,
} from '../services/auth.js';

export const authRouter = Router();

authRouter.get('/csrf', (_req, res) => {
  const token = randomBytes(24).toString('hex');
  res.cookie('ds_csrf', token, { httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 86400000 });
  res.json({ csrfToken: token });
});

authRouter.post('/otp/request', validate(z.object({ phone: z.string().min(7).max(16) })), asyncRoute(async (req, res) => {
  const phone = req.body.phone.replace(/[^0-9+]/g, '');
  const code = createOtp(phone);
  const { devCode } = await smsProvider.send(phone, `Your Deutsch Studio verification code is ${code}. It expires in 10 minutes.`);
  const existing = get<any>('SELECT * FROM users WHERE phone=?', phone);
  res.json({ ok: true, devCode, isNewUser: !existing });
}));

authRouter.post('/otp/verify', validate(z.object({ phone: z.string().min(7), code: z.string().length(6), name: z.string().min(2).optional(), role: z.enum(['student', 'parent']).optional() })), (req, res) => {
  const { phone, code, name, role } = req.body;
  const result = verifyOtp(phone.replace(/[^0-9+]/g, ''), code);
  if (result !== 'ok') return res.status(result === 'locked' ? 429 : 400).json({ error: result === 'locked' ? 'Too many attempts. Try again later.' : result === 'expired' ? 'Code expired. Request a new one.' : 'Incorrect code.' });
  let u = get<any>('SELECT * FROM users WHERE phone=?', phone);
  if (!u) {
    if (!name || !role) return res.status(400).json({ error: 'New users must provide a name and role.', needsRegistration: true });
    run(`INSERT INTO users (name,phone,email,password_hash,role,level,consent_at,created_at) VALUES (?,?,?,?,?,?,?,?)`,
      name, phone, null, hashPassword(randomBytes(18).toString('hex')), role, null, now(), now());
    u = get<any>('SELECT * FROM users WHERE phone=?', phone);
  }
  issueTokens(res, publicUser(u));
  res.json({ user: publicUser(u) });
});

// Login-free demo access: issues a real session for one of the seeded accounts.
// Set DEMO_AUTO_LOGIN=false to disable this shortcut in a non-demo deployment.
authRouter.post('/demo', validate(z.object({ role: z.enum(['student', 'parent', 'tutor', 'admin']).optional() })), (req, res) => {
  if (process.env.DEMO_AUTO_LOGIN === 'false') return res.status(403).json({ error: 'Demo access is disabled.' });
  const role = req.body.role || 'student';
  const u = get<any>('SELECT * FROM users WHERE role=? AND status=? ORDER BY id ASC LIMIT 1', role, 'active');
  if (!u) return res.status(404).json({ error: `No demo ${role} account found.` });
  issueTokens(res, publicUser(u));
  res.json({ user: publicUser(u) });
});

authRouter.post('/password', validate(z.object({ email: z.string().email(), password: z.string().min(6) })), (req, res) => {
  const u = get<any>('SELECT * FROM users WHERE email=? COLLATE NOCASE AND status=?', req.body.email, 'active');
  if (!u || !checkPassword(req.body.password, u.password_hash)) return res.status(401).json({ error: 'Incorrect email or password.' });
  issueTokens(res, publicUser(u));
  res.json({ user: publicUser(u) });
});

authRouter.post('/refresh', (req, res) => {
  const u = verifyRefreshToken(req.cookies?.ds_refresh);
  if (!u) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  revokeRefresh(req.cookies.ds_refresh);
  issueTokens(res, u);
  res.json({ ok: true });
});

authRouter.post('/logout', (req, res) => {
  if (req.cookies?.ds_refresh) revokeRefresh(req.cookies.ds_refresh);
  res.clearCookie('ds_access'); res.clearCookie('ds_refresh', { path: '/api/auth' }); res.clearCookie('ds_session');
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req: any, res) => {
  const u = get<any>('SELECT * FROM users WHERE id=?', req.user.id);
  if (!u) return res.status(401).json({ error: 'Account not found' });
  const institute = get<any>('SELECT * FROM institutes WHERE id=1');
  const children = u.role === 'parent'
    ? all<any>(`SELECT u.id,u.name,u.level,u.photo_url FROM parent_student_links l JOIN users u ON u.id=l.student_id WHERE l.parent_id=? AND l.status='active'`, u.id)
    : [];
  res.json({ user: publicUser(u), profile: { ...publicUser(u), consent_at: u.consent_at }, children, institute: institute && {
    name: institute.name, tagline: institute.tagline, logo: institute.logo, colors: JSON.parse(institute.colors || '{}'),
    contact: JSON.parse(institute.contact || '{}'), policies: institute.policies,
  } });
});

authRouter.patch('/profile', requireAuth, validate(z.object({
  name: z.string().min(2).max(80).optional(), photo_url: z.string().max(500).optional().nullable(),
  level: z.string().max(10).optional().nullable(), locale: z.enum(['en', 'hi']).optional(), theme: z.enum(['light', 'dark']).optional(),
})), (req: any, res) => {
  const fields = Object.keys(req.body).filter((k) => ['name', 'photo_url', 'level', 'locale', 'theme'].includes(k));
  if (fields.length) run(`UPDATE users SET ${fields.map((f) => `${f}=?`).join(',')} WHERE id=?`, ...fields.map((f) => req.body[f]), req.user.id);
  res.json({ user: publicUser(get<any>('SELECT * FROM users WHERE id=?', req.user.id)) });
});

authRouter.post('/link-parent', requireAuth, validate(z.object({ code: z.string().min(4) })), (req: any, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: 'Only parent accounts can link children.' });
  const link = get<any>(`SELECT * FROM parent_student_links WHERE invite_code=? AND status='active'`, req.body.code.trim().toUpperCase());
  if (!link) return res.status(404).json({ error: 'Invalid or expired invite code.' });
  run('UPDATE parent_student_links SET parent_id=?, status=? WHERE id=?', req.user.id, 'active', link.id);
  res.json({ ok: true, studentId: link.student_id });
});

authRouter.get('/export', requireAuth, (req: any, res) => {
  const me = get<any>('SELECT id,name,email,phone,role,level,created_at FROM users WHERE id=?', req.user.id);
  const studentIds = req.user.role === 'parent'
    ? all<{ student_id: number }>('SELECT student_id FROM parent_student_links WHERE parent_id=?', req.user.id).map((r) => r.student_id)
    : [req.user.id];
  const payload: any = { exported_at: now(), account: me, children: [], attendance: [], submissions: [], invoices: [], messages: [] };
  for (const sid of studentIds) {
    payload.children.push(get<any>('SELECT id,name,level FROM users WHERE id=?', sid));
    payload.attendance.push(...all<any>('SELECT a.status,a.reason,a.marked_at,s.title,s.starts_at FROM attendance a JOIN class_sessions s ON s.id=a.session_id WHERE a.student_id=?', sid));
    payload.submissions.push(...all<any>('SELECT h.title,s.status,s.marks,s.comments,s.submitted_at FROM submissions s JOIN homework h ON h.id=s.homework_id WHERE s.student_id=?', sid));
    payload.invoices.push(...all<any>('SELECT number,amount,total,due_at,status FROM invoices WHERE student_id=?', sid));
  }
  if (req.user.role === 'student') payload.messages = all<any>('SELECT m.body,m.created_at,c.name room FROM chat_messages m JOIN chat_rooms c ON c.id=m.room_id WHERE m.sender_id=? ORDER BY m.id DESC LIMIT 500', req.user.id);
  res.setHeader('Content-Disposition', 'attachment; filename="deutsch-studio-data-export.json"');
  res.json(payload);
});

authRouter.post('/delete-request', requireAuth, validate(z.object({ reason: z.string().max(500).optional() })), (req: any, res) => {
  run('INSERT INTO deletion_requests (user_id,reason,status,created_at) VALUES (?,?,?,?)', req.user.id, req.body.reason || null, 'pending', now());
  res.json({ ok: true, message: 'Your deletion request has been recorded. Our team will process it within 30 days.' });
});

authRouter.get('/access-check', requireAuth, (req: any, res) => {
  res.json({ id: req.user.id, role: req.user.role, valid: !!verifyAccessToken(req.cookies?.ds_access) });
});
