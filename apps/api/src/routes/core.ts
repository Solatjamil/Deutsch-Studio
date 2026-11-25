import { Router } from 'express';
import { z } from 'zod';
import { all, get, now, parse, run, daysFromNow } from '../db/index.js';
import { assertBatchAccess, assertStudentAccess, asyncRoute, audit, isStaff, requireAuth, requireRole, validate, visibleStudents } from '../middleware.js';
import { publicUser } from '../services/auth.js';

export const coreRouter = Router();

const announcedFor = async (user: any) => {
  if (isStaff(user)) return (await all<any>('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50'));
  if (user.role === 'student') {
    const ids = (await all<{ batch_id: number }>('SELECT batch_id FROM enrollments WHERE student_id=?', user.id)).map((r) => r.batch_id);
    return (await all<any>(`SELECT * FROM announcements WHERE batch_id IS NULL ${ids.map(() => 'OR batch_id IN (?)').join(' ')} ORDER BY created_at DESC LIMIT 50`, ...ids)).filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);
  }
  const ids = (await visibleStudents(user));
  return (await all<any>(`SELECT * FROM announcements WHERE batch_id IS NULL OR batch_id IN (SELECT batch_id FROM enrollments WHERE student_id IN (${ids.map(() => '?').join(',') || 'NULL'})) ORDER BY created_at DESC LIMIT 50`, ...ids));
};

async function attendancePct(studentId: number, batchId?: number) {
  const rows = (await all<any>(`SELECT a.status FROM attendance a ${batchId ? 'JOIN class_sessions s ON s.id=a.session_id WHERE a.student_id=? AND s.batch_id=?' : 'WHERE a.student_id=?'}`, ...(batchId ? [studentId, batchId] : [studentId])));
  if (!rows.length) return { pct: 0, present: 0, total: 0, absent: 0, late: 0, leave: 0 };
  const present = rows.filter((r) => r.status === 'present' || r.status === 'late').length;
  return { pct: Math.round((present / rows.length) * 100), total: rows.length, present,
    absent: rows.filter((r) => r.status === 'absent').length, late: rows.filter((r) => r.status === 'late').length,
    leave: rows.filter((r) => r.status === 'leave').length };
}

coreRouter.get('/dashboard', requireAuth, asyncRoute(async (req: any, res) => {
      const u = (await get<any>('SELECT * FROM users WHERE id=?', req.user.id));
      const today = new Date().toISOString().slice(0, 10);
      const announcements = await Promise.all((await announcedFor(req.user)).slice(0, 3).map(async (a: any) => ({
                                                                  ...a, attachments: parse(a.attachments, []),
                                                                  reads: (await get<{ n: number }>('SELECT COUNT(*) n FROM announcement_reads WHERE announcement_id=?', a.id))?.n || 0,
                                                                  readByMe: !!(await get('SELECT 1 FROM announcement_reads WHERE announcement_id=? AND user_id=?', a.id, req.user.id)),
                                                                })));

      if (isStaff(req.user)) {
        const sessions = (await all<any>(`SELECT s.*, b.name batch_name, c.title course_title FROM class_sessions s
      JOIN batches b ON b.id=s.batch_id JOIN courses c ON c.id=b.course_id
      WHERE date(s.starts_at)=? ORDER BY s.starts_at`, today));
        const marked = (await all<any>(`SELECT DISTINCT session_id FROM attendance WHERE marked_by=? AND date(marked_at)=?`, req.user.id, today)).map((r) => r.session_id);
        const defaulters = (await all<any>(`SELECT u.id,u.name,u.phone,i.number,i.total,i.due_at FROM invoices i JOIN users u ON u.id=i.student_id
      WHERE i.status IN ('pending','overdue') AND i.due_at < ? ORDER BY i.due_at LIMIT 10`, daysFromNow(14)));
        return res.json({
          role: 'tutor',
          kpis: {
            students: (await get<{ n: number }>(`SELECT COUNT(*) n FROM users WHERE role='student'`))?.n || 0,
            batches: (await get<{ n: number }>('SELECT COUNT(*) n FROM batches'))?.n || 0,
            pendingReviews: (await get<{ n: number }>(`SELECT COUNT(*) n FROM submissions WHERE status='submitted'`))?.n || 0,
            defaulters: defaulters.length,
            collectionRate: (async () => { const p = (await get<{ paid: number; total_count: number }>(`SELECT SUM(CASE WHEN status='paid' THEN total ELSE 0 END) paid, SUM(total) AS total_count FROM invoices`))!; return p.total_count ? Math.round((p.paid / p.total_count) * 100) : 0; })(),
          },
          sessions: await Promise.all(sessions.map(async (s) => ({ ...s, needsAttendance: !(await get('SELECT 1 FROM attendance WHERE session_id=?', s.id)) }))),
          pendingReviews: (await all<any>(`SELECT s.id,s.status,s.submitted_at,h.title,u.name student_name FROM submissions s JOIN homework h ON h.id=s.homework_id JOIN users u ON u.id=s.student_id WHERE s.status='submitted' ORDER BY s.submitted_at LIMIT 6`)),
          defaulters, announcements,
          attendedToday: marked.length,
        });
      }

      if (req.user.role === 'parent') {
        const children = (await all<any>(`SELECT u.id,u.name,u.level,u.photo_url FROM parent_student_links l JOIN users u ON u.id=l.student_id WHERE l.parent_id=? AND l.status='active'`, req.user.id));
        let child = children[0];
        if (req.query.childId) {
          const requested = children.find((c: any) => String(c.id) === String(req.query.childId));
          if (requested) child = requested;
        }
        const inv = child ? (await all<any>(`SELECT i.*,p.name plan_name FROM invoices i JOIN fee_plans p ON p.id=i.plan_id WHERE i.student_id=? ORDER BY i.issued_at DESC LIMIT 5`, child.id)) : [];
        return res.json({
          role: 'parent', children, child,
          attendance: child ? (await attendancePct(child.id)) : null,
          homework: child ? (await all<any>(`SELECT s.status,s.marks,h.title,h.due_at FROM submissions s RIGHT JOIN homework h ON h.id=s.homework_id AND s.student_id=? JOIN batches b ON b.id=h.batch_id JOIN enrollments e ON e.batch_id=b.id AND e.student_id=? ORDER BY h.due_at LIMIT 6`, child.id, child.id)).map((h) => ({ ...h, status: h.status || 'pending' })) : [],
          fees: { due: inv.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.total, 0), invoices: inv },
          report: child ? (await get<any>('SELECT r.*,b.name batch_name FROM report_cards r JOIN batches b ON b.id=r.batch_id WHERE r.student_id=? ORDER BY r.generated_at DESC LIMIT 1', child.id)) : null,
          sessions: child ? (await all<any>(`SELECT s.*,b.name batch_name FROM class_sessions s JOIN batches b ON b.id=s.batch_id JOIN enrollments e ON e.batch_id=b.id WHERE e.student_id=? AND s.starts_at>=? ORDER BY s.starts_at LIMIT 4`, child.id, now())).map((s) => ({ ...s, is_live: !!s.is_live })) : [],
          announcements,
        });
      }

      const batches = (await all<any>(`SELECT b.*,c.title course_title,c.code,c.accent,e.progress_pct FROM enrollments e JOIN batches b ON b.id=e.batch_id JOIN courses c ON c.id=b.course_id WHERE e.student_id=?`, req.user.id));
      const homework = (await all<any>(`SELECT h.id,h.title,h.due_at,h.max_marks,s.status,s.marks FROM homework h JOIN enrollments e ON e.batch_id=h.batch_id LEFT JOIN submissions s ON s.homework_id=h.id AND s.student_id=? WHERE e.student_id=? ORDER BY h.due_at`, req.user.id, req.user.id));
      const invoices = (await all<any>(`SELECT i.*,p.name plan_name FROM invoices i JOIN fee_plans p ON p.id=i.plan_id WHERE i.student_id=? ORDER BY i.issued_at DESC`, req.user.id));
      const nextLesson = (await get<any>(`SELECT l.*,m.title module_title,c.title course_title FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id JOIN batches b ON b.course_id=c.id JOIN enrollments e ON e.batch_id=b.id WHERE e.student_id=? ORDER BY m.position,l.position LIMIT 1`, req.user.id));
      return res.json({
        role: 'student', user: publicUser(u), batches,
        sessions: (await all<any>(`SELECT s.*,b.name batch_name FROM class_sessions s JOIN batches b ON b.id=s.batch_id JOIN enrollments e ON e.batch_id=b.id WHERE e.student_id=? AND s.starts_at>=? ORDER BY s.starts_at LIMIT 5`, req.user.id, new Date(Date.now() - 6 * 3600000).toISOString())).map((s) => ({ ...s, is_live: !!s.is_live })),
        homework: homework.map((h) => ({ ...h, status: h.status || 'pending' })),
        attendance: (await attendancePct(req.user.id)),
        feeDue: invoices.filter((i) => i.status !== 'paid').reduce((sum, i) => sum + i.total, 0),
        invoices: invoices.slice(0, 3), announcements, nextLesson,
        pendingHomework: homework.filter((h) => !h.status || h.status === 'pending' || h.status === 'late').length,
      });
    }));

coreRouter.get('/courses', requireAuth, asyncRoute(async (req: any, res) => {
      const courses = (await all<any>(`SELECT c.*,u.name tutor_name,
    (SELECT COUNT(*) FROM modules m WHERE m.course_id=c.id) modules,
    (SELECT COUNT(*) FROM modules m JOIN lessons l ON l.module_id=m.id WHERE m.course_id=c.id) lessons,
    (SELECT COUNT(*) FROM enrollments e JOIN batches b ON b.id=e.batch_id WHERE b.course_id=c.id AND e.student_id=?) enrolled
    FROM courses c LEFT JOIN users u ON u.id=c.tutor_id ORDER BY c.id`, req.user.id));
      res.json(courses.map((c) => ({ ...c, syllabus: parse(c.syllabus, []) })));
    }));

coreRouter.get('/courses/:id', requireAuth, asyncRoute(async (req: any, res) => {
      const course = (await get<any>('SELECT c.*,u.name tutor_name FROM courses c LEFT JOIN users u ON u.id=c.tutor_id WHERE c.id=?', req.params.id));
      if (!course) return res.status(404).json({ error: 'Course not found' });
      const modules = await Promise.all((await all<any>('SELECT * FROM modules WHERE course_id=? ORDER BY position', course.id)).map(async (m) => ({
                                                                  ...m, lessons: (await all<any>('SELECT id,title,video_url,duration_min,position,description FROM lessons WHERE module_id=? ORDER BY position', m.id)),
                                                                })));
      const batches = (await all<any>('SELECT * FROM batches WHERE course_id=?', course.id));
      const enrollment = (await get<any>('SELECT progress_pct FROM enrollments WHERE student_id=? AND batch_id IN (SELECT id FROM batches WHERE course_id=?) LIMIT 1', req.user.id, course.id));
      res.json({ ...course, syllabus: parse(course.syllabus, []), modules, batches, progress: enrollment?.progress_pct || 0 });
    }));

coreRouter.post('/courses/:id/enroll', requireAuth, validate(z.object({ batchId: z.number().int().optional(), discountCode: z.string().max(30).optional() })), asyncRoute(async (req: any, res) => {
      if (req.user.role !== 'student') return res.status(403).json({ error: 'Only student accounts can enroll.' });
      const course = (await get<any>('SELECT * FROM courses WHERE id=?', req.params.id));
      if (!course) return res.status(404).json({ error: 'Course not found' });
      const batchId = req.body.batchId || (await get<{ id: number }>('SELECT id FROM batches WHERE course_id=? ORDER BY id LIMIT 1', course.id))?.id;
      if (!batchId) return res.status(400).json({ error: 'This course has no open batch yet.' });
      if ((await get('SELECT 1 FROM enrollments WHERE student_id=? AND batch_id=?', req.user.id, batchId))) return res.status(409).json({ error: 'You are already enrolled in this batch.' });
      const discount = req.body.discountCode?.toUpperCase() === 'WELCOME10' ? 1000 : 0;
      (await run('INSERT INTO enrollments (student_id,batch_id,progress_pct,enrolled_at) VALUES (?,?,0,?)', req.user.id, batchId, now()));
      const plan = (await get<any>('SELECT * FROM fee_plans WHERE course_id=? ORDER BY id LIMIT 1', course.id));
      let invoice = null;
      if (plan) {
        const amount = plan.amount - discount;
        const number = `DS-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}`;
        const info = (await run('INSERT INTO invoices (number,student_id,plan_id,amount,discount,total,due_at,status,issued_at) VALUES (?,?,?,?,?,?,?,?,?)',
          number, req.user.id, plan.id, plan.amount, discount, amount, daysFromNow(plan.due_days), 'pending', now()));
        invoice = (await get<any>('SELECT * FROM invoices WHERE id=?', Number(info.lastInsertRowid)));
      }
      (await audit(req, 'enroll', { courseId: course.id, batchId }));
      res.status(201).json({ ok: true, batchId, invoice });
    }));

coreRouter.get('/batches', requireAuth, asyncRoute(async (req: any, res) => {
      const rows = isStaff(req.user)
        ? (await all<any>(`SELECT b.*,c.title course_title,c.code,u.name tutor_name,(SELECT COUNT(*) FROM enrollments e WHERE e.batch_id=b.id) students FROM batches b JOIN courses c ON c.id=b.course_id LEFT JOIN users u ON u.id=b.tutor_id ORDER BY b.id`))
        : (await all<any>(`SELECT DISTINCT b.*,c.title course_title,c.code,u.name tutor_name,(SELECT COUNT(*) FROM enrollments e WHERE e.batch_id=b.id) students FROM batches b JOIN courses c ON c.id=b.course_id LEFT JOIN users u ON u.id=b.tutor_id JOIN enrollments e ON e.batch_id=b.id WHERE e.student_id IN (${(await visibleStudents(req.user)).map(() => '?').join(',') || 'NULL'}) ORDER BY b.id`, ...(await visibleStudents(req.user))));
      res.json(rows.map((b) => ({ ...b, schedule: parse(b.schedule, []) })));
    }));

coreRouter.get('/schedule', requireAuth, asyncRoute(async (req: any, res) => {
      const from = String(req.query.from || daysFromNow(-30));
      const to = String(req.query.to || daysFromNow(30));
      const rows = isStaff(req.user)
        ? (await all<any>(`SELECT s.*,b.name batch_name,c.title course_title FROM class_sessions s JOIN batches b ON b.id=s.batch_id JOIN courses c ON c.id=b.course_id WHERE date(s.starts_at) BETWEEN date(?) AND date(?) ORDER BY s.starts_at`, from, to))
        : (await all<any>(`SELECT DISTINCT s.*,b.name batch_name,c.title course_title FROM class_sessions s JOIN batches b ON b.id=s.batch_id JOIN courses c ON c.id=b.course_id JOIN enrollments e ON e.batch_id=b.id WHERE e.student_id IN (${(await visibleStudents(req.user)).map(() => '?').join(',') || 'NULL'}) AND date(s.starts_at) BETWEEN date(?) AND date(?) ORDER BY s.starts_at`, ...(await visibleStudents(req.user)), from, to));
      res.json(rows.map((s) => ({ ...s, is_live: !!s.is_live, agenda: parse(s.agenda, '') })));
    }));

coreRouter.post('/sessions', requireAuth, requireRole('tutor', 'admin'), validate(z.object({
  batchId: z.number().int(), title: z.string().min(2), startsAt: z.string(), endsAt: z.string(), meetingUrl: z.string().optional(), agenda: z.string().optional(),
})), asyncRoute(async (req: any, res) => {
      (await assertBatchAccess(req.user, req.body.batchId));
      const room = `DeutschStudio-${req.body.batchId}-${Date.now().toString().slice(-6)}`;
      const info = (await run('INSERT INTO class_sessions (batch_id,title,starts_at,ends_at,meeting_url,room_name,is_live,agenda) VALUES (?,?,?,?,?,?,?,?)',
        req.body.batchId, req.body.title, req.body.startsAt, req.body.endsAt, req.body.meetingUrl || `https://meet.jit.si/${room}`, room, 0, req.body.agenda || ''));
      (await audit(req, 'session.create', req.body.title));
      res.status(201).json({ id: Number(info.lastInsertRowid) });
    }));

coreRouter.post('/sessions/:id/join', requireAuth, asyncRoute(async (req: any, res) => {
      if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students join classes.' });
      const session = (await get<any>('SELECT * FROM class_sessions WHERE id=?', req.params.id));
      if (!session) return res.status(404).json({ error: 'Class not found' });
      (await assertBatchAccess(req.user, session.batch_id));
      (await run(`INSERT INTO attendance (session_id,student_id,status,reason,marked_by,marked_at) VALUES (?,?,'present','Auto-marked on join',?,?)
       ON CONFLICT(session_id,student_id) DO UPDATE SET status='present',marked_at=excluded.marked_at`, session.id, req.user.id, req.user.id, now()));
      (await run('INSERT INTO notifications (user_id,category,title,body,data,created_at) VALUES (?,?,?,?,?,?)',
        req.user.id, 'class', 'Attendance recorded', `You were marked present for ${session.title}.`, JSON.stringify({ sessionId: session.id }), now()));
      res.json({ ok: true, meetingUrl: session.meeting_url, roomName: session.room_name });
    }));

coreRouter.get('/announcements', requireAuth, asyncRoute(async (req: any, res) => {
      res.json(await Promise.all((await announcedFor(req.user)).map(async (a: any) => ({
                                                                      ...a, attachments: parse(a.attachments, []),
                                                                      reads: (await get<{ n: number }>('SELECT COUNT(*) n FROM announcement_reads WHERE announcement_id=?', a.id))?.n || 0,
                                                                      recipients: isStaff(req.user) ? (await all<{ id: number }>(`SELECT DISTINCT e.student_id id FROM enrollments e WHERE e.batch_id=?`, a.batch_id)).length + (a.batch_id ? 0 : (await get<{ n: number }>(`SELECT COUNT(*) n FROM users WHERE role IN ('student','parent')`))?.n || 0) : undefined,
                                                                      readByMe: !!(await get('SELECT 1 FROM announcement_reads WHERE announcement_id=? AND user_id=?', a.id, req.user.id)),
                                                                    }))));
    }));

coreRouter.post('/announcements', requireAuth, requireRole('tutor', 'admin'), validate(z.object({
  title: z.string().min(2), body: z.string().min(3), batchId: z.number().int().nullable().optional(),
})), asyncRoute(async (req: any, res) => {
      const info = (await run('INSERT INTO announcements (author_id,batch_id,title,body,attachments,created_at) VALUES (?,?,?,?,?,?)',
        req.user.id, req.body.batchId || null, req.body.title, req.body.body, '[]', now()));
      const id = Number(info.lastInsertRowid);
      const recipients = req.body.batchId
        ? (await all<{ student_id: number }>('SELECT student_id FROM enrollments WHERE batch_id=?', req.body.batchId)).map((r) => r.student_id)
        : (await all<{ id: number }>(`SELECT id FROM users WHERE role IN ('student','parent')`)).map((r) => r.id);
      await Promise.all(recipients.map(async (uid) => (await run('INSERT INTO notifications (user_id,category,title,body,data,created_at) VALUES (?,?,?,?,?,?)',
                                                                            uid, 'class', req.body.title, req.body.body.slice(0, 120), JSON.stringify({ announcementId: id }), now()))));
      (await audit(req, 'announcement.create', id));
      res.status(201).json({ id });
    }));

coreRouter.post('/announcements/:id/read', requireAuth, asyncRoute(async (req: any, res) => {
      (await run('INSERT OR IGNORE INTO announcement_reads (announcement_id,user_id,read_at) VALUES (?,?,?)', req.params.id, req.user.id, now()));
      res.json({ ok: true });
    }));

coreRouter.get('/notifications', requireAuth, asyncRoute(async (req: any, res) => {
      res.json((await all<any>('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100', req.user.id)).map((n) => ({ ...n, data: parse(n.data, {}) })));
    }));

coreRouter.post('/notifications/read', requireAuth, validate(z.object({ id: z.number().int().optional() })), asyncRoute(async (req: any, res) => {
      if (req.body.id) (await run('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?', now(), req.body.id, req.user.id));
      else (await run('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL', now(), req.user.id));
      res.json({ ok: true });
    }));

coreRouter.get('/notifications/prefs', requireAuth, asyncRoute(async (req: any, res) => {
      const cats = ['class', 'homework', 'fee', 'attendance', 'material', 'chat'];
      const rows = (await all<any>('SELECT category,enabled FROM notification_prefs WHERE user_id=?', req.user.id));
      res.json(Object.fromEntries(cats.map((c) => [c, rows.find((r) => r.category === c)?.enabled !== 0])));
    }));

coreRouter.put('/notifications/prefs', requireAuth, validate(z.object({ prefs: z.record(z.boolean()) })), asyncRoute(async (req: any, res) => {
      for (const [category, enabled] of Object.entries(req.body.prefs)) {
        (await run('INSERT INTO notification_prefs (user_id,category,enabled) VALUES (?,?,?) ON CONFLICT(user_id,category) DO UPDATE SET enabled=excluded.enabled', req.user.id, category, enabled ? 1 : 0));
      }
      res.json({ ok: true });
    }));

coreRouter.get('/institute', asyncRoute(async (_req, res) => {
      const i = (await get<any>('SELECT * FROM institutes WHERE id=1'))!;
      res.json({ name: i.name, tagline: i.tagline, logo: i.logo, colors: parse(i.colors, {}), contact: parse(i.contact, {}), policies: i.policies, address: i.address });
    }));

coreRouter.put('/institute', requireAuth, requireRole('admin'), asyncRoute(async (req: any, res) => {
      const i = (await get<any>('SELECT * FROM institutes WHERE id=1'))!;
      (await run('UPDATE institutes SET name=?,tagline=?,contact=?,policies=?,address=?,updated_at=? WHERE id=1',
        req.body.name || i.name, req.body.tagline || i.tagline, JSON.stringify(req.body.contact || parse(i.contact, {})),
        req.body.policies || i.policies, req.body.address || i.address, now()));
      (await audit(req, 'institute.update'));
      res.json({ ok: true });
    }));

coreRouter.get('/practice/word', requireAuth, asyncRoute(async (_req, res) => {
      const cards = (await all<any>('SELECT * FROM flashcards'));
      res.json(cards[Math.floor(Math.random() * cards.length)] || null);
    }));

coreRouter.get('/practice/flashcards', requireAuth, asyncRoute(async (req: any, res) => {
      const user = (await get<any>('SELECT level FROM users WHERE id=?', req.user.id));
      res.json((await all<any>('SELECT * FROM flashcards WHERE level=? OR level IS NULL ORDER BY next_review LIMIT 30', user?.level || 'A1')));
    }));

coreRouter.post('/practice/flashcards/:id', requireAuth, validate(z.object({ correct: z.boolean() })), asyncRoute(async (req: any, res) => {
      const card = (await get<any>('SELECT * FROM flashcards WHERE id=?', req.params.id));
      if (!card) return res.status(404).json({ error: 'Card not found' });
      const box = req.body.correct ? Math.min(5, (card.box || 1) + 1) : 1;
      (await run('UPDATE flashcards SET box=?,next_review=? WHERE id=?', box, daysFromNow(box * 2), card.id));
      res.json({ ok: true, box });
    }));

coreRouter.post('/practice/quiz', requireAuth, validate(z.object({ answers: z.record(z.string()) })), (req: any, res) => {
  const qs = [
    ['"Hello" in German', 'Hallo'], ['"Thank you" in German', 'Danke'], ['"Good morning" in German', 'Guten Morgen'],
    ['The verb "to be" (ich)', 'bin'], ['"Please" in German', 'Bitte'],
  ];
  let score = 0;
  qs.forEach(([, answer], i) => { if ((req.body.answers[String(i)] || '').trim().toLowerCase() === answer.toLowerCase()) score++; });
  res.json({ score, total: qs.length, questions: qs.map(([q]) => q) });
});

export { attendancePct };
