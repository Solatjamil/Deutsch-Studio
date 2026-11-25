import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { UPLOAD_DIR } from '../config.js';
import { all, get, now, parse, run } from '../db/index.js';
import { asyncRoute, audit, isStaff, requireAuth, requireRole, validate, visibleStudents } from '../middleware.js';
import { hashPassword, publicUser } from '../services/auth.js';
import { saveUpload, upload } from '../services/storage.js';

export const adminRouter = Router();

adminRouter.get('/overview', requireAuth, requireRole('admin', 'tutor'), asyncRoute(async (_req, res) => {
      res.json({
        students: (await get<{ n: number }>(`SELECT COUNT(*) n FROM users WHERE role='student'`))?.n || 0,
        parents: (await get<{ n: number }>(`SELECT COUNT(*) n FROM users WHERE role='parent'`))?.n || 0,
        tutors: (await get<{ n: number }>(`SELECT COUNT(*) n FROM users WHERE role IN ('tutor','admin')`))?.n || 0,
        batches: (await get<{ n: number }>('SELECT COUNT(*) n FROM batches'))?.n || 0,
        courses: (await get<{ n: number }>('SELECT COUNT(*) n FROM courses'))?.n || 0,
        materials: (await get<{ n: number }>('SELECT COUNT(*) n FROM materials'))?.n || 0,
        attendance: (await get<{ n: number; p: number }>(`SELECT COUNT(*) n,SUM(CASE WHEN status='present' OR status='late' THEN 1 ELSE 0 END) p FROM attendance`)) || { n: 0, p: 0 },
        submissions: (await get<{ n: number; reviewed: number }>(`SELECT COUNT(*) n,SUM(CASE WHEN status='reviewed' THEN 1 ELSE 0 END) reviewed FROM submissions`)) || { n: 0, reviewed: 0 },
        collection: (await get<{ v: number }>("SELECT COALESCE(SUM(amount),0) v FROM payments WHERE status='success'"))?.v || 0,
        outstanding: (await get<{ v: number }>("SELECT COALESCE(SUM(total),0) v FROM invoices WHERE status!='paid'"))?.v || 0,
      });
    }));

adminRouter.get('/users', requireAuth, requireRole('admin', 'tutor'), asyncRoute(async (req: any, res) => {
      const { role, q, batchId } = req.query as Record<string, string>;
      const rows = (await all<any>(`SELECT u.id,u.name,u.phone,u.email,u.role,u.level,u.status,u.created_at,b.name batch_name,
    (SELECT COUNT(*) FROM parent_student_links l WHERE l.parent_id=u.id AND l.status='active') children
    FROM users u LEFT JOIN batches b ON b.id=u.batch_id
    WHERE (? IS NULL OR u.role=?) AND (? IS NULL OR (u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?))
      AND (? IS NULL OR EXISTS(SELECT 1 FROM enrollments e WHERE e.student_id=u.id AND e.batch_id=?))
    ORDER BY u.id LIMIT 300`, role || null, role || null, q || null, `%${q || ''}%`, `%${q || ''}%`, `%${q || ''}%`, batchId || null, batchId || null));
      res.json(rows);
    }));

adminRouter.post('/users', requireAuth, requireRole('admin'), validate(z.object({
  name: z.string().min(2), phone: z.string().min(7), email: z.string().email().optional(),
  role: z.enum(['student', 'parent', 'tutor', 'admin']), level: z.string().optional(), batchId: z.number().int().optional(),
})), asyncRoute(async (req: any, res) => {
      if ((await get('SELECT 1 FROM users WHERE phone=?', req.body.phone))) return res.status(409).json({ error: 'A user with this phone already exists.' });
      const tempPassword = `DS${Math.random().toString(36).slice(2, 8)}`;
      const password = process.env.DEFAULT_NEW_USER_PASSWORD || 'Demo1234!';
      void tempPassword;
      const info = (await run('INSERT INTO users (name,phone,email,password_hash,role,level,batch_id,consent_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        req.body.name, req.body.phone, req.body.email || null, hashPassword(password), req.body.role, req.body.level || null, req.body.batchId || null, now(), now()));
      if (req.body.role === 'student' && req.body.batchId) (await run('INSERT OR IGNORE INTO enrollments (student_id,batch_id,enrolled_at) VALUES (?,?,?)', Number(info.lastInsertRowid), req.body.batchId, now()));
      (await audit(req, 'user.create', { id: Number(info.lastInsertRowid), role: req.body.role }));
      res.status(201).json({ id: Number(info.lastInsertRowid), temporaryPassword: password });
    }));

adminRouter.patch('/users/:id', requireAuth, requireRole('admin'), asyncRoute(async (req: any, res) => {
      const allowed = ['name', 'level', 'status', 'batch_id', 'role'];
      const fields = Object.keys(req.body).filter((k) => allowed.includes(k));
      if (fields.length) (await run(`UPDATE users SET ${fields.map((f) => `${f}=?`).join(',')} WHERE id=?`, ...fields.map((f) => req.body[f]), req.params.id));
      (await audit(req, 'user.update', req.params.id));
      res.json({ ok: true });
    }));

adminRouter.post('/batches', requireAuth, requireRole('admin', 'tutor'), validate(z.object({
  name: z.string().min(2), courseId: z.number().int(), startDate: z.string(), endDate: z.string(), tutorId: z.number().int().optional(),
})), asyncRoute(async (req: any, res) => {
      const info = (await run('INSERT INTO batches (name,course_id,start_date,end_date,tutor_id,schedule,capacity) VALUES (?,?,?,?,?,?,?)',
        req.body.name, req.body.courseId, req.body.startDate, req.body.endDate, req.body.tutorId || req.user.id, '[]', 30));
      (await audit(req, 'batch.create', req.body.name));
      res.status(201).json({ id: Number(info.lastInsertRowid) });
    }));

adminRouter.post('/import-students', requireAuth, requireRole('admin', 'tutor'), upload.single('file'), asyncRoute(async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file is required.' });
  const text = req.file.buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift()?.toLowerCase().split(',').map((s: string) => s.trim()) || [];
  const nameI = header.indexOf('name'), phoneI = header.indexOf('phone'), emailI = header.indexOf('email'), levelI = header.indexOf('level');
  if (nameI < 0 || phoneI < 0) return res.status(400).json({ error: 'CSV needs name and phone columns.' });
  let created = 0, skipped = 0;
  for (const line of lines) {
    const cols = line.split(',').map((s: string) => s.trim());
    const name = cols[nameI], phone = cols[phoneI];
    if (!name || !phone || (await get('SELECT 1 FROM users WHERE phone=?', phone))) { skipped++; continue; }
    (await run('INSERT INTO users (name,phone,email,password_hash,role,level,consent_at,created_at) VALUES (?,?,?,?,?,?,?,?)',
      name, phone, emailI >= 0 ? cols[emailI] || null : null, hashPassword('Demo1234!'), 'student', levelI >= 0 ? cols[levelI] || null : null, now(), now()));
    created++;
  }
  (await audit(req, 'students.import', { created, skipped }));
  res.json({ created, skipped });
}));

adminRouter.post('/upload', requireAuth, requireRole('tutor', 'admin'), upload.array('files', 4), asyncRoute(async (req: any, res) => {
  const files = await Promise.all((req.files || []).map((f: Express.Multer.File) => saveUpload(f, req.user.id, req.body.purpose || 'material')));
  res.status(201).json({ files });
}));

adminRouter.get('/files/:name', requireAuth, asyncRoute(async (req: any, res) => {
      const name = String(req.params.name);
      if (!/^[a-f0-9-]+\.[a-z0-9]+$/.test(name) || name.includes('..')) return res.status(400).json({ error: 'Invalid file' });
      const file = (await get<any>('SELECT * FROM files WHERE name=?', name));
      if (!file) return res.status(404).json({ error: 'File not found' });
      const ids = isStaff(req.user) ? [] : (await visibleStudents(req.user));
      if (!isStaff(req.user) && file.owner_id !== req.user.id && !ids.length) return res.status(403).json({ error: 'Access denied' });
      res.setHeader('Content-Type', file.mime);
      fs.createReadStream(path.join(UPLOAD_DIR, name)).pipe(res);
    }));

adminRouter.get('/audit', requireAuth, requireRole('admin'), asyncRoute(async (_req, res) => {
      res.json((await all<any>(`SELECT a.*,u.name actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100`)));
    }));

adminRouter.get('/deletion-requests', requireAuth, requireRole('admin'), asyncRoute(async (_req, res) => {
      res.json((await all<any>(`SELECT d.*,u.name,u.email,u.phone FROM deletion_requests d JOIN users u ON u.id=d.user_id ORDER BY d.created_at DESC`)));
    }));

adminRouter.patch('/deletion-requests/:id', requireAuth, requireRole('admin'), validate(z.object({ status: z.enum(['approved', 'rejected']) })), asyncRoute(async (req: any, res) => {
      const reqRow = (await get<any>('SELECT * FROM deletion_requests WHERE id=?', req.params.id));
      if (!reqRow) return res.status(404).json({ error: 'Request not found' });
      (await run('UPDATE deletion_requests SET status=? WHERE id=?', req.body.status, req.params.id));
      if (req.body.status === 'approved') {
        (await run('UPDATE users SET status=?,name=?,phone=?,email=?,password_hash=? WHERE id=?',
          'deleted', 'Deleted user', `deleted-${reqRow.user_id}-${Date.now()}`, null, 'deleted', reqRow.user_id));
      }
      (await audit(req, 'deletion.resolve', { id: req.params.id, status: req.body.status }));
      res.json({ ok: true });
    }));

adminRouter.get('/analytics', requireAuth, requireRole('admin', 'tutor'), asyncRoute(async (_req, res) => {
      const attendanceTrend = (await all<any>(`SELECT substr(s.starts_at,1,7) AS "month", ROUND(100.0*SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)/COUNT(*)) pct
    FROM attendance a JOIN class_sessions s ON s.id=a.session_id GROUP BY "month" ORDER BY "month" DESC LIMIT 6`)).reverse();
      const performers = (await all<any>(`SELECT u.id,u.name,ROUND(AVG(a.score*10.0/NULLIF(a.max_score,0))) score,
    (SELECT ROUND(100.0*SUM(CASE WHEN st.status IN ('present','late') THEN 1 ELSE 0 END)/COUNT(*)) FROM attendance st WHERE st.student_id=u.id) attendance
    FROM test_attempts a JOIN users u ON u.id=a.student_id GROUP BY u.id ORDER BY score DESC LIMIT 5`));
      const homeworkRate = (await get<{ done: number; total_count: number }>(`SELECT SUM(CASE WHEN status IN ('submitted','reviewed','late') THEN 1 ELSE 0 END) done, COUNT(*) AS total_count FROM submissions`));
      res.json({ attendanceTrend, performers, homeworkRate, revenue: (await all<any>(`SELECT substr(paid_at,1,7) AS "month",SUM(amount) amount FROM payments GROUP BY "month" ORDER BY "month" DESC LIMIT 6`)).reverse() });
    }));

adminRouter.post('/courses', requireAuth, requireRole('admin', 'tutor'), validate(z.object({
  title: z.string().min(2), code: z.string().min(2), level: z.string().optional(), description: z.string().optional(),
  price: z.number().int().positive(), durationWeeks: z.number().int().optional(), tutorId: z.number().int().optional(),
})), asyncRoute(async (req: any, res) => {
      const info = (await run('INSERT INTO courses (code,title,level,description,syllabus,duration_weeks,price,tutor_id,schedule_text,accent) VALUES (?,?,?,?,?,?,?,?,?,?)',
        req.body.code, req.body.title, req.body.level || null, req.body.description || '', '[]', req.body.durationWeeks || 8, req.body.price, req.body.tutorId || req.user.id, '', '#1f6f5c'));
      (await audit(req, 'course.create', req.body.title));
      res.status(201).json({ id: Number(info.lastInsertRowid) });
    }));

adminRouter.post('/courses/:id/modules', requireAuth, requireRole('admin', 'tutor'), validate(z.object({ title: z.string().min(2), lessons: z.array(z.object({ title: z.string(), videoUrl: z.string() })).optional() })), asyncRoute(async (req: any, res) => {
      const info = (await run('INSERT INTO modules (course_id,title,position) VALUES (?,?,?)', req.params.id, req.body.title,
        (await get<{ n: number }>('SELECT COUNT(*) n FROM modules WHERE course_id=?', req.params.id))?.n || 0));
      await Promise.all((req.body.lessons || []).map(async (l: any, i: number) => (await run('INSERT INTO lessons (module_id,title,video_url,duration_min,position) VALUES (?,?,?,?,?)',
                                                                            Number(info.lastInsertRowid), l.title, l.videoUrl, 10, i))));
      res.status(201).json({ id: Number(info.lastInsertRowid) });
    }));

adminRouter.get('/reports', requireAuth, requireRole('admin', 'tutor'), asyncRoute(async (_req, res) => {
      res.json((await all<any>(`SELECT r.*,u.name student_name,b.name batch_name FROM report_cards r JOIN users u ON u.id=r.student_id JOIN batches b ON b.id=r.batch_id ORDER BY r.generated_at DESC`)));
    }));

adminRouter.get('/invite-codes', requireAuth, requireRole('admin', 'tutor'), asyncRoute(async (_req, res) => {
      res.json((await all<any>(`SELECT l.invite_code,u.name student_name,p.name parent_name FROM parent_student_links l JOIN users u ON u.id=l.student_id LEFT JOIN users p ON p.id=l.parent_id`)));
    }));
