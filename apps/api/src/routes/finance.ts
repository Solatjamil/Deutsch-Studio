import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { all, get, now, run, daysFromNow } from '../db/index.js';
import { assertStudentAccess, audit, requireAuth, requireRole, validate, visibleStudents, asyncRoute } from '../middleware.js';
import { payments } from '../services/auth.js';

export const financeRouter = Router();

const invoiceFor = async (user: any, invoiceId: number) => {
  const inv = (await get<any>('SELECT * FROM invoices WHERE id=?', invoiceId));
  if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  (await assertStudentAccess(user, inv.student_id));
  return inv;
};

financeRouter.get('/summary', requireAuth, asyncRoute(async (req: any, res) => {
      const studentId = Number(req.query.studentId || (req.user.role === 'parent' ? (await visibleStudents(req.user))[0] : req.user.id));
      if (!studentId) return res.json({ due: 0, paid: 0, invoices: [], payments: [] });
      (await assertStudentAccess(req.user, studentId));
      const invoices = (await all<any>(`SELECT i.*,p.name plan_name,c.title course_title FROM invoices i JOIN fee_plans p ON p.id=i.plan_id JOIN courses c ON c.id=p.course_id WHERE i.student_id=? ORDER BY i.issued_at DESC`, studentId));
      const payRows = (await all<any>('SELECT * FROM payments WHERE student_id=? ORDER BY paid_at DESC', studentId));
      res.json({
        studentId,
        due: invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.total, 0),
        paid: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0),
        invoices, payments: payRows,
        today: now().slice(0, 10),
      });
    }));

financeRouter.get('/invoices', requireAuth, asyncRoute(async (req: any, res) => {
      const studentId = Number(req.query.studentId || (req.user.role === 'parent' ? (await visibleStudents(req.user))[0] : req.user.id));
      if (studentId) (await assertStudentAccess(req.user, studentId));
      const ids = studentId ? [studentId] : (await visibleStudents(req.user));
      res.json((await all<any>(`SELECT i.*,u.name student_name,p.name plan_name FROM invoices i JOIN users u ON u.id=i.student_id JOIN fee_plans p ON p.id=i.plan_id
    WHERE i.student_id IN (${ids.map(() => '?').join(',') || 'NULL'}) ORDER BY i.issued_at DESC`, ...ids)));
    }));

financeRouter.post('/pay', requireAuth, validate(z.object({ invoiceId: z.number().int(), method: z.string().max(30).optional() })), asyncRoute(async (req: any, res, next) => {
      try {
        const inv = (await invoiceFor(req.user, req.body.invoiceId));
        if (inv.status === 'paid') return res.status(409).json({ error: 'This invoice is already paid.' });
        // TODO(PAYMENT): gateway.createOrder returns a checkout URL in production.
        const result = await payments.createOrder(inv.id, inv.total);
        const info = (await run('INSERT INTO payments (invoice_id,student_id,amount,method,gateway_ref,status,paid_at,recorded_by) VALUES (?,?,?,?,?,?,?,?)',
          inv.id, inv.student_id, inv.total, req.body.method || 'mock-gateway', result.ref, 'success', now(), req.user.role === 'student' || req.user.role === 'parent' ? null : req.user.id));
        (await run('UPDATE invoices SET status=? WHERE id=?', 'paid', inv.id));
        await Promise.all((await all<{ id: number }>(`SELECT id FROM users WHERE role IN ('tutor','admin')`)).map(async (t) => {
                                                                                                                (await run('INSERT INTO notifications (user_id,category,title,body,data,created_at) VALUES (?,?,?,?,?,?)', t.id, 'fee', 'Payment received', `Invoice ${inv.number} was paid.`, JSON.stringify({ invoiceId: inv.id }), now()));
                                                                                                              }));
        (await audit(req, 'payment.mock', inv.id));
        res.json({ ok: true, paymentId: Number(info.lastInsertRowid), ref: result.ref, checkoutUrl: result.checkoutUrl || null });
      } catch (err) { next(err); }
    }));

financeRouter.post('/cash', requireAuth, requireRole('tutor', 'admin'), validate(z.object({ invoiceId: z.number().int(), amount: z.number().int().positive(), note: z.string().max(200).optional() })), asyncRoute(async (req: any, res) => {
      const inv = (await get<any>('SELECT * FROM invoices WHERE id=?', req.body.invoiceId));
      if (!inv) return res.status(404).json({ error: 'Invoice not found' });
      const info = (await run('INSERT INTO payments (invoice_id,student_id,amount,method,gateway_ref,status,paid_at,recorded_by) VALUES (?,?,?,?,?,?,?,?)',
        inv.id, inv.student_id, req.body.amount, 'cash', req.body.note || `CASH-${Date.now().toString().slice(-6)}`, 'success', now(), req.user.id));
      const paid = (await all<{ total: number }>('SELECT amount FROM payments WHERE invoice_id=?', inv.id)).reduce((s, p) => s + p.total, 0);
      (await run('UPDATE invoices SET status=? WHERE id=?', paid >= inv.total ? 'paid' : 'partial', inv.id));
      (await audit(req, 'payment.cash', inv.id));
      res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
    }));

financeRouter.get('/defaulters', requireAuth, requireRole('tutor', 'admin'), asyncRoute(async (req: any, res) => {
      res.json((await all<any>(`SELECT i.*,u.name,u.phone,p.name plan_name FROM invoices i JOIN users u ON u.id=i.student_id JOIN fee_plans p ON p.id=i.plan_id
    WHERE i.status IN ('pending','overdue','partial') ORDER BY i.due_at`)));
    }));

financeRouter.get('/collections', requireAuth, requireRole('tutor', 'admin'), asyncRoute(async (_req, res) => {
      const monthly = (await all<any>(`SELECT substr(paid_at,1,7) AS "month",SUM(amount) amount FROM payments WHERE status='success' GROUP BY "month" ORDER BY "month" DESC LIMIT 8`));
      const methods = (await all<any>(`SELECT method,SUM(amount) amount,COUNT(*) count FROM payments WHERE status='success' GROUP BY method`));
      res.json({
        monthly, methods,
        collected: (await get<{ v: number }>("SELECT COALESCE(SUM(amount),0) v FROM payments WHERE status='success'"))?.v || 0,
        outstanding: (await get<{ v: number }>("SELECT COALESCE(SUM(total),0) v FROM invoices WHERE status!='paid'"))?.v || 0,
        invoiceCount: (await get<{ v: number }>('SELECT COUNT(*) v FROM invoices'))?.v || 0,
      });
    }));

financeRouter.post('/reminders', requireAuth, requireRole('tutor', 'admin'), validate(z.object({ invoiceIds: z.array(z.number().int()).min(1) })), asyncRoute(async (req: any, res) => {
      await Promise.all(req.body.invoiceIds.map(async (id: number) => {
                                                                            const inv = (await get<any>('SELECT * FROM invoices WHERE id=?', id));
                                                                            if (!inv) return;
                                                                            (await run('INSERT INTO notifications (user_id,category,title,body,data,created_at) VALUES (?,?,?,?,?,?)',
                                                                              inv.student_id, 'fee', 'Fee reminder', `Please pay invoice ${inv.number} (${inv.total}).`, JSON.stringify({ invoiceId: id }), now()));
                                                                            await Promise.all((await all<{ parent_id: number }>('SELECT parent_id FROM parent_student_links WHERE student_id=? AND status=?', inv.student_id, 'active')).map(async (p) =>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            (await run('INSERT INTO notifications (user_id,category,title,body,data,created_at) VALUES (?,?,?,?,?,?)',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              p.parent_id, 'fee', 'Fee reminder', `A fee is due for your child (${inv.number}).`, JSON.stringify({ invoiceId: id }), now()))));
                                                                          }));
      (await audit(req, 'fee.reminders', req.body.invoiceIds.length));
      res.json({ ok: true, sent: req.body.invoiceIds.length });
    }));

financeRouter.get('/invoice/:id/pdf', requireAuth, asyncRoute(async (req: any, res) => {
      const inv = (await invoiceFor(req.user, Number(req.params.id)));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${inv.number}.pdf"`);
      const doc = new PDFDocument({ margin: 48 });
      doc.pipe(res);
      doc.fontSize(22).fillColor('#1f6f5c').text('Deutsch Studio');
      doc.fontSize(10).fillColor('#666').text('hello@deutschstudio.demo · Sahiwal, Punjab, Pakistan').moveDown(2);
      doc.fontSize(18).fillColor('#222').text(`Invoice ${inv.number}`);
      doc.fontSize(11).text(`Issued: ${inv.issued_at.slice(0, 10)}   Due: ${inv.due_at.slice(0, 10)}`).moveDown();
      doc.text(`Status: ${inv.status.toUpperCase()}`).moveDown();
      doc.moveTo(48, doc.y).lineTo(547, doc.y).stroke();
      doc.text('Course fee').text(String(inv.amount), 420, doc.y - 14);
      doc.text('Discount').text(String(-inv.discount), 420, doc.y - 14);
      doc.moveDown().fontSize(14).text(`Total: ${inv.total}`).moveDown();
      doc.fontSize(10).fillColor('#777').text('Demo invoice generated by Deutsch Studio. Payment status is simulated in the sandbox gateway.');
      doc.end();
    }));

financeRouter.post('/invoices', requireAuth, requireRole('tutor', 'admin'), validate(z.object({
  studentId: z.number().int(), planId: z.number().int(), amount: z.number().int().positive(),
  dueAt: z.string().optional(), discount: z.number().int().min(0).optional(),
})), asyncRoute(async (req: any, res) => {
      const number = `DS-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
      const discount = req.body.discount || 0;
      const info = (await run('INSERT INTO invoices (number,student_id,plan_id,amount,discount,total,due_at,status,issued_at) VALUES (?,?,?,?,?,?,?,?,?)',
        number, req.body.studentId, req.body.planId, req.body.amount, discount, req.body.amount - discount,
        req.body.dueAt || daysFromNow(7), 'pending', now()));
      (await audit(req, 'invoice.create', number));
      res.status(201).json({ id: Number(info.lastInsertRowid), number });
    }));

financeRouter.get('/plans', requireAuth, asyncRoute(async (_req, res) => {
      res.json((await all<any>('SELECT p.*,c.title course_title FROM fee_plans p JOIN courses c ON c.id=p.course_id ORDER BY p.id')));
    }));

financeRouter.post('/plans', requireAuth, requireRole('admin'), validate(z.object({ courseId: z.number().int(), name: z.string(), amount: z.number().int().positive(), planType: z.string().optional(), installments: z.number().int().optional() })), asyncRoute(async (req: any, res) => {
      const info = (await run('INSERT INTO fee_plans (course_id,name,amount,plan_type,installments,due_days) VALUES (?,?,?,?,?,?)',
        req.body.courseId, req.body.name, req.body.amount, req.body.planType || 'one-time', req.body.installments || 1, 7));
      res.status(201).json({ id: Number(info.lastInsertRowid) });
    }));
