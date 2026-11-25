import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { all, get, now, parse, run, daysFromNow } from '../db/index.js';
import { assertBatchAccess, assertStudentAccess, asyncRoute, audit, isStaff, requireAuth, requireRole, validate, visibleStudents } from '../middleware.js';
import { attendancePct } from './core.js';
import { saveUpload, upload } from '../services/storage.js';

export const academicsRouter = Router();

// Shared authenticated upload endpoint for homework attachments and audio notes.
academicsRouter.post('/upload', requireAuth, upload.array('files', 4), asyncRoute(async (req: any, res) => {
  const files = await Promise.all((req.files || []).map((f: Express.Multer.File) => saveUpload(f, req.user.id, req.body.purpose || 'homework')));
  res.status(201).json({ files });
}));

// ── Attendance ────────────────────────────────────────────────────────────────
academicsRouter.get('/attendance/summary', requireAuth, (req: any, res) => {
  const studentId = Number(req.query.studentId || req.user.id);
  assertStudentAccess(req.user, studentId);
  const batchId = req.query.batchId ? Number(req.query.batchId) : undefined;
  const records = all<any>(`SELECT a.*,s.title,s.starts_at,b.name batch_name FROM attendance a JOIN class_sessions s ON s.id=a.session_id JOIN batches b ON b.id=s.batch_id
    WHERE a.student_id=? ${batchId ? 'AND s.batch_id=?' : ''} ORDER BY s.starts_at DESC LIMIT 100`, ...(batchId ? [studentId, batchId] : [studentId]));
  const summary = attendancePct(studentId, batchId);
  const byMonth: Record<string, { present: number; total: number }> = {};
  records.forEach((r) => {
    const key = r.starts_at.slice(0, 7);
    byMonth[key] ||= { present: 0, total: 0 };
    byMonth[key].total++;
    if (r.status === 'present' || r.status === 'late') byMonth[key].present++;
  });
  const leaves = all<any>('SELECT * FROM leave_requests WHERE student_id=? ORDER BY created_at DESC', studentId);
  res.json({ ...summary, records, byMonth, leaves, studentId });
});

academicsRouter.get('/attendance/batch/:batchId', requireAuth, (req: any, res) => {
  assertBatchAccess(req.user, Number(req.params.batchId));
  const date = String(req.query.date || now().slice(0, 10));
  const sessions = all<any>('SELECT * FROM class_sessions WHERE batch_id=? AND date(starts_at)=? ORDER BY starts_at', req.params.batchId, date);
  const session = sessions[0] || get<any>('SELECT * FROM class_sessions WHERE batch_id=? ORDER BY starts_at DESC LIMIT 1', req.params.batchId);
  const students = all<any>(`SELECT u.id,u.name,u.photo_url,a.status,a.reason FROM enrollments e JOIN users u ON u.id=e.student_id
    LEFT JOIN attendance a ON a.student_id=u.id AND a.session_id=? WHERE e.batch_id=? AND e.status='active' ORDER BY u.name`, session?.id || 0, req.params.batchId);
  res.json({ date, session, sessions, students: students.map((s) => ({ ...s, status: s.status || 'present' })) });
});

academicsRouter.post('/attendance/batch/:batchId', requireAuth, requireRole('tutor', 'admin'),
  validate(z.object({ date: z.string(), sessionId: z.number().int().optional(), records: z.array(z.object({ studentId: z.number().int(), status: z.enum(['present', 'absent', 'late', 'leave']), reason: z.string().max(200).optional() })) })),
  (req: any, res) => {
    assertBatchAccess(req.user, Number(req.params.batchId));
    const sessionId = req.body.sessionId || get<{ id: number }>('SELECT id FROM class_sessions WHERE batch_id=? AND date(starts_at)=? ORDER BY starts_at LIMIT 1', req.params.batchId, req.body.date)?.id;
    if (!sessionId) return res.status(404).json({ error: 'No class session found for that date.' });
    const session = get<any>('SELECT * FROM class_sessions WHERE id=?', sessionId);
    if (!session || session.batch_id !== Number(req.params.batchId)) return res.status(400).json({ error: 'Session does not belong to this batch.' });
    for (const r of req.body.records) {
      const enrolled = get('SELECT 1 FROM enrollments WHERE batch_id=? AND student_id=?', req.params.batchId, r.studentId);
      if (!enrolled) return res.status(403).json({ error: 'A student is not enrolled in this batch.' });
      run(`INSERT INTO attendance (session_id,student_id,status,reason,marked_by,marked_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,marked_by=excluded.marked_by,marked_at=excluded.marked_at`,
        sessionId, r.studentId, r.status, r.reason || null, req.user.id, now());
      if (r.status === 'absent') {
        all<{ parent_id: number }>('SELECT parent_id FROM parent_student_links WHERE student_id=? AND status=?', r.studentId, 'active').forEach((p) => {
          run('INSERT INTO notifications (user_id,category,title,body,data,created_at) VALUES (?,?,?,?,?,?)',
            p.parent_id, 'attendance', 'Attendance alert', `${get<any>('SELECT name FROM users WHERE id=?', r.studentId)?.name} was marked absent.`, JSON.stringify({ studentId: r.studentId }), now());
        });
      }
    }
    audit(req, 'attendance.mark', { batchId: req.params.batchId, count: req.body.records.length });
    res.json({ ok: true, updated: req.body.records.length });
  });

academicsRouter.get('/attendance/export/:batchId', requireAuth, requireRole('tutor', 'admin'), (req: any, res) => {
  assertBatchAccess(req.user, Number(req.params.batchId));
  const rows = all<any>(`SELECT s.starts_at,u.name,a.status,a.reason FROM attendance a JOIN class_sessions s ON s.id=a.session_id JOIN users u ON u.id=a.student_id
    WHERE s.batch_id=? ORDER BY s.starts_at DESC`, req.params.batchId);
  const csv = ['Date,Student,Status,Reason', ...rows.map((r) => `${r.starts_at.slice(0, 10)},"${r.name.replace(/"/g, '""')}",${r.status},"${(r.reason || '').replace(/"/g, '""')}"`)].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-batch-${req.params.batchId}.csv"`);
  res.send(csv);
});

academicsRouter.get('/leave-requests', requireAuth, (req: any, res) => {
  const ids = isStaff(req.user) ? [] : visibleStudents(req.user);
  const rows = isStaff(req.user)
    ? all<any>('SELECT l.*,u.name student_name FROM leave_requests l JOIN users u ON u.id=l.student_id ORDER BY l.created_at DESC LIMIT 100')
    : all<any>(`SELECT l.*,u.name student_name FROM leave_requests l JOIN users u ON u.id=l.student_id WHERE l.student_id IN (${ids.map(() => '?').join(',') || 'NULL'}) ORDER BY l.created_at DESC`, ...ids);
  res.json(rows);
});

academicsRouter.post('/leave-requests', requireAuth, validate(z.object({ date: z.string(), reason: z.string().min(4).max(300) })), (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can request leave.' });
  const info = run('INSERT INTO leave_requests (student_id,date,reason,status,created_at) VALUES (?,?,?,?,?)', req.user.id, req.body.date, req.body.reason, 'pending', now());
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

academicsRouter.patch('/leave-requests/:id', requireAuth, requireRole('tutor', 'admin'), validate(z.object({ status: z.enum(['approved', 'rejected']) })), (req: any, res) => {
  run('UPDATE leave_requests SET status=?,reviewed_by=? WHERE id=?', req.body.status, req.user.id, req.params.id);
  res.json({ ok: true });
});

// ── Homework ──────────────────────────────────────────────────────────────────
const homeworkFor = (user: any) => {
  const ids = visibleStudents(user);
  if (isStaff(user)) return all<any>(`SELECT h.*,b.name batch_name,c.title course_title,
    (SELECT COUNT(*) FROM submissions s WHERE s.homework_id=h.id) submitted,
    (SELECT COUNT(*) FROM submissions s WHERE s.homework_id=h.id AND s.status='submitted') pending
    FROM homework h JOIN batches b ON b.id=h.batch_id JOIN courses c ON c.id=b.course_id ORDER BY h.due_at DESC LIMIT 100`);
  return all<any>(`SELECT h.*,b.name batch_name,c.title course_title,s.status,s.marks,s.id submission_id FROM homework h
    JOIN batches b ON b.id=h.batch_id JOIN courses c ON c.id=b.course_id
    LEFT JOIN submissions s ON s.homework_id=h.id AND s.student_id IN (${ids.map(() => '?').join(',') || 'NULL'})
    JOIN enrollments e ON e.batch_id=b.id AND e.student_id IN (${ids.map(() => '?').join(',') || 'NULL'})
    ORDER BY h.due_at DESC LIMIT 100`, ...ids, ...ids);
};

academicsRouter.get('/homework', requireAuth, (req: any, res) => {
  res.json(homeworkFor(req.user).map((h) => ({ ...h, attachments: parse(h.attachments, []), status: h.status || 'pending' })));
});

academicsRouter.get('/homework/:id', requireAuth, (req: any, res) => {
  const h = get<any>(`SELECT h.*,b.name batch_name,c.title course_title FROM homework h JOIN batches b ON b.id=h.batch_id JOIN courses c ON c.id=b.course_id WHERE h.id=?`, req.params.id);
  if (!h) return res.status(404).json({ error: 'Homework not found' });
  assertBatchAccess(req.user, h.batch_id);
  const subs = isStaff(req.user)
    ? all<any>(`SELECT s.*,u.name student_name FROM submissions s JOIN users u ON u.id=s.student_id WHERE s.homework_id=? ORDER BY s.submitted_at DESC`, h.id)
    : all<any>(`SELECT s.*,u.name student_name FROM submissions s JOIN users u ON u.id=s.student_id WHERE s.homework_id=? AND s.student_id IN (${visibleStudents(req.user).map(() => '?').join(',') || 'NULL'})`, h.id, ...visibleStudents(req.user));
  res.json({ ...h, attachments: parse(h.attachments, []), submissions: subs.map((s) => ({ ...s, files: parse(s.files, []) })) });
});

academicsRouter.post('/homework', requireAuth, requireRole('tutor', 'admin'),
  validate(z.object({ batchId: z.number().int(), title: z.string().min(2), instructions: z.string().min(3), dueAt: z.string(), maxMarks: z.number().int().min(1).max(100).optional(), attachments: z.array(z.object({ name: z.string(), url: z.string() })).optional() })),
  (req: any, res) => {
    assertBatchAccess(req.user, req.body.batchId);
    const info = run('INSERT INTO homework (batch_id,tutor_id,title,instructions,due_at,max_marks,attachments,created_at) VALUES (?,?,?,?,?,?,?,?)',
      req.body.batchId, req.user.id, req.body.title, req.body.instructions, req.body.dueAt, req.body.maxMarks || 10, JSON.stringify(req.body.attachments || []), now());
    const students = all<{ student_id: number }>('SELECT student_id FROM enrollments WHERE batch_id=?', req.body.batchId);
    students.forEach((s) => run('INSERT INTO notifications (user_id,category,title,body,data,created_at) VALUES (?,?,?,?,?,?)',
      s.student_id, 'homework', 'New homework', req.body.title, JSON.stringify({ homeworkId: Number(info.lastInsertRowid) }), now()));
    audit(req, 'homework.create', req.body.title);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

academicsRouter.post('/homework/:id/submit', requireAuth,
  validate(z.object({ text: z.string().max(5000).optional(), files: z.array(z.object({ name: z.string(), url: z.string() })).optional(), audioUrl: z.string().max(500).optional().nullable() })),
  (req: any, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can submit homework.' });
    const h = get<any>('SELECT * FROM homework WHERE id=?', req.params.id);
    if (!h) return res.status(404).json({ error: 'Homework not found' });
    assertBatchAccess(req.user, h.batch_id);
    if (!get('SELECT 1 FROM enrollments WHERE batch_id=? AND student_id=?', h.batch_id, req.user.id)) return res.status(403).json({ error: 'You are not enrolled in this batch.' });
    const late = new Date(h.due_at) < new Date();
    const existing = get<any>('SELECT * FROM submissions WHERE homework_id=? AND student_id=?', h.id, req.user.id);
    if (existing?.status === 'reviewed') return res.status(409).json({ error: 'This submission has already been reviewed.' });
    run(`INSERT INTO submissions (homework_id,student_id,text,files,audio_url,status,submitted_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(homework_id,student_id) DO UPDATE SET text=excluded.text,files=excluded.files,audio_url=excluded.audio_url,status=excluded.status,submitted_at=excluded.submitted_at,marks=NULL,comments=NULL,reviewed_at=NULL`,
      h.id, req.user.id, req.body.text || '', JSON.stringify(req.body.files || []), req.body.audioUrl || null, late ? 'late' : 'submitted', now());
    all<{ id: number }>('SELECT id FROM users WHERE role IN (?,?)', 'tutor', 'admin').forEach((t) => {
      run('INSERT INTO notifications (user_id,category,title,body,data,created_at) VALUES (?,?,?,?,?,?)', t.id, 'homework', 'New submission', `${req.user.name} submitted ${h.title}`, JSON.stringify({ homeworkId: h.id }), now());
    });
    res.json({ ok: true, status: late ? 'late' : 'submitted' });
  });

academicsRouter.post('/submissions/:id/review', requireAuth, requireRole('tutor', 'admin'),
  validate(z.object({ marks: z.number().int().min(0).max(100), comments: z.string().max(2000).optional(), voiceFeedbackUrl: z.string().max(500).optional().nullable() })),
  (req: any, res) => {
    const sub = get<any>('SELECT * FROM submissions WHERE id=?', req.params.id);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    run('UPDATE submissions SET marks=?,comments=?,voice_feedback_url=?,status=?,reviewed_at=?,reviewed_by=? WHERE id=?',
      req.body.marks, req.body.comments || '', req.body.voiceFeedbackUrl || null, 'reviewed', now(), req.user.id, sub.id);
    run('INSERT INTO notifications (user_id,category,title,body,data,created_at) VALUES (?,?,?,?,?,?)',
      sub.student_id, 'homework', 'Homework reviewed', `Your work received ${req.body.marks} marks.`, JSON.stringify({ submissionId: sub.id }), now());
    audit(req, 'submission.review', sub.id);
    res.json({ ok: true });
  });

// ── Tests & reports ───────────────────────────────────────────────────────────
academicsRouter.get('/tests', requireAuth, (req: any, res) => {
  const ids = isStaff(req.user) ? [] : visibleStudents(req.user);
  const rows = isStaff(req.user)
    ? all<any>(`SELECT t.*,b.name batch_name,(SELECT COUNT(*) FROM test_attempts a WHERE a.test_id=t.id) attempts FROM tests t JOIN batches b ON b.id=t.batch_id ORDER BY t.scheduled_at`)
    : all<any>(`SELECT DISTINCT t.*,b.name batch_name,a.score,a.id attempt_id FROM tests t JOIN batches b ON b.id=t.batch_id JOIN enrollments e ON e.batch_id=b.id AND e.student_id IN (${ids.map(() => '?').join(',') || 'NULL'}) LEFT JOIN test_attempts a ON a.test_id=t.id AND a.student_id IN (${ids.map(() => '?').join(',') || 'NULL'}) ORDER BY t.scheduled_at`, ...ids, ...ids);
  res.json(rows);
});

academicsRouter.get('/tests/:id', requireAuth, (req: any, res) => {
  const test = get<any>('SELECT * FROM tests WHERE id=?', req.params.id);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  assertBatchAccess(req.user, test.batch_id);
  const questions = all<any>('SELECT id,type,prompt,options,marks,correct_answer FROM questions WHERE test_id=? ORDER BY id', test.id);
  const attempt = get<any>('SELECT * FROM test_attempts WHERE test_id=? AND student_id IN (' + visibleStudents(req.user).map(() => '?').join(',') + ') ORDER BY id DESC LIMIT 1', test.id, ...visibleStudents(req.user));
  // Hide answer keys from students until they have attempted (or from staff previews).
  const reveal = isStaff(req.user) || !!attempt;
  res.json({ ...test, questions: questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, options: parse(q.options, []), marks: q.marks, ...(reveal ? { correct_answer: q.correct_answer } : {}) })),
    attempt: attempt && { ...attempt, answers: parse(attempt.answers, {}) } });
});

academicsRouter.post('/tests/:id/attempt', requireAuth,
  validate(z.object({ answers: z.record(z.string()) })),
  (req: any, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can take tests.' });
    const test = get<any>('SELECT * FROM tests WHERE id=?', req.params.id);
    if (!test) return res.status(404).json({ error: 'Test not found' });
    assertBatchAccess(req.user, test.batch_id);
    const questions = all<any>('SELECT * FROM questions WHERE test_id=?', test.id);
    const maxScore = questions.reduce((s, q) => s + q.marks, 0);
    let score = 0;
    questions.forEach((q) => { if (req.body.answers[String(q.id)] === q.correct_answer) score += q.marks; });
    run(`INSERT INTO test_attempts (test_id,student_id,answers,score,max_score,started_at,submitted_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(test_id,student_id) DO UPDATE SET answers=excluded.answers,score=excluded.score,max_score=excluded.max_score,submitted_at=excluded.submitted_at`,
      test.id, req.user.id, JSON.stringify(req.body.answers), score, maxScore, now(), now());
    res.json({ score, maxScore, percentage: Math.round((score / (maxScore || 1)) * 100) });
  });

academicsRouter.post('/tests', requireAuth, requireRole('tutor', 'admin'),
  validate(z.object({ batchId: z.number().int(), title: z.string().min(2), durationMin: z.number().int().min(5).max(180), scheduledAt: z.string(),
    questions: z.array(z.object({ prompt: z.string(), options: z.array(z.string()), answer: z.string(), marks: z.number().int().min(1).optional() })).min(1) })),
  (req: any, res) => {
    assertBatchAccess(req.user, req.body.batchId);
    const info = run('INSERT INTO tests (batch_id,title,duration_min,scheduled_at,status,created_by,created_at) VALUES (?,?,?,?,?,?,?)',
      req.body.batchId, req.body.title, req.body.durationMin, req.body.scheduledAt, 'published', req.user.id, now());
    req.body.questions.forEach((q: any) => run('INSERT INTO questions (test_id,type,prompt,options,correct_answer,marks) VALUES (?,?,?,?,?,?)',
      Number(info.lastInsertRowid), 'mcq', q.prompt, JSON.stringify(q.options), q.answer, q.marks || 2));
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

academicsRouter.get('/reports', requireAuth, (req: any, res) => {
  const ids = req.query.studentId ? [Number(req.query.studentId)] : visibleStudents(req.user);
  ids.forEach((id) => assertStudentAccess(req.user, id));
  const rows = ids.flatMap((id) => all<any>(`SELECT r.*,u.name student_name,b.name batch_name,c.title course_title FROM report_cards r
    JOIN users u ON u.id=r.student_id JOIN batches b ON b.id=r.batch_id JOIN courses c ON c.id=b.course_id
    WHERE r.student_id=? ORDER BY r.generated_at DESC`, id));
  res.json(rows.map((r) => ({ ...r, skills: parse(r.skills, {}) })));
});

academicsRouter.get('/reports/:id/pdf', requireAuth, (req: any, res) => {
  const r = get<any>('SELECT r.*,u.name student_name,b.name batch_name FROM report_cards r JOIN users u ON u.id=r.student_id JOIN batches b ON b.id=r.batch_id WHERE r.id=?', req.params.id);
  if (!r) return res.status(404).json({ error: 'Report not found' });
  assertStudentAccess(req.user, r.student_id);
  const skills = parse(r.skills, {});
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="report-${r.student_id}.pdf"`);
  const doc = new PDFDocument({ margin: 48 });
  doc.pipe(res);
  doc.fontSize(22).fillColor('#1f6f5c').text('Deutsch Studio');
  doc.fontSize(11).fillColor('#333').text('Performance report · ' + r.period).moveDown();
  doc.fontSize(17).text(r.student_name); doc.fontSize(11).text(r.batch_name).moveDown();
  doc.text(`Attendance: ${r.attendance_pct}%   |   Homework completion: ${r.homework_pct}%   |   Rank: ${r.rank} of ${r.total_students}`).moveDown();
  doc.fontSize(14).text('Skill breakdown');
  Object.entries(skills).forEach(([k, v]) => doc.fontSize(11).text(`${k}: ${v}/100`));
  doc.moveDown().fontSize(14).text('Tutor remarks');
  doc.fontSize(11).text(r.remarks || 'No remarks recorded.').moveDown();
  doc.fontSize(9).fillColor('#777').text('Generated by Deutsch Studio · Demo document');
  doc.end();
});

// ── Materials ─────────────────────────────────────────────────────────────────
academicsRouter.get('/materials', requireAuth, (req: any, res) => {
  const { q, level, type, favorite } = req.query as Record<string, string>;
  const rows = all<any>(`SELECT m.*,CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END favorite FROM materials m
    LEFT JOIN material_favorites f ON f.material_id=m.id AND f.user_id=?
    WHERE (? IS NULL OR m.title LIKE ?) AND (? IS NULL OR m.level=?) AND (? IS NULL OR m.type=?)
    ORDER BY m.created_at DESC LIMIT 200`, req.user.id, q || null, `%${q || ''}%`, level || null, level || null, type || null, type || null);
  res.json(favorite === 'true' ? rows.filter((r) => r.favorite) : rows);
});

academicsRouter.post('/materials/:id/favorite', requireAuth, (req: any, res) => {
  const exists = get('SELECT 1 FROM material_favorites WHERE user_id=? AND material_id=?', req.user.id, req.params.id);
  if (exists) run('DELETE FROM material_favorites WHERE user_id=? AND material_id=?', req.user.id, req.params.id);
  else run('INSERT INTO material_favorites (user_id,material_id) VALUES (?,?)', req.user.id, req.params.id);
  res.json({ favorite: !exists });
});

academicsRouter.post('/materials', requireAuth, requireRole('tutor', 'admin'),
  validate(z.object({ title: z.string().min(2), type: z.string().min(2), level: z.string().optional(), topic: z.string().optional(), url: z.string().optional() })),
  (req: any, res) => {
    const info = run('INSERT INTO materials (title,type,level,topic,url,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?)',
      req.body.title, req.body.type, req.body.level || null, req.body.topic || null, req.body.url || null, req.user.id, now());
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

// Demo files are generated on demand so the demo never ships binary fixtures.
academicsRouter.get('/files/:name', requireAuth, (req: any, res) => res.redirect(`/api/files/demo/${encodeURIComponent(String(req.params.name))}`));

academicsRouter.get('/files/demo/:name', requireAuth, (req: any, res) => {
  const name = String(req.params.name);
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return res.status(400).json({ error: 'Invalid file name' });
  if (name.endsWith('.wav')) {
    const rate = 8000, seconds = 2, samples = rate * seconds;
    const buffer = Buffer.alloc(44 + samples * 2);
    buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(Math.sin((i / rate) * 440 * 2 * Math.PI) * 4000), 44 + i * 2);
    res.setHeader('Content-Type', 'audio/wav'); return res.send(buffer);
  }
  res.setHeader('Content-Type', 'application/pdf');
  const doc = new PDFDocument();
  doc.pipe(res);
  doc.fontSize(18).fillColor('#1f6f5c').text('Deutsch Studio · Study Material');
  doc.moveDown().fontSize(12).fillColor('#333').text('This is sample demo content used to show how study material is delivered in the app.');
  doc.moveDown().fontSize(11).text('German practice tip: learn vocabulary in sentences, not as isolated words.');
  doc.end();
});
