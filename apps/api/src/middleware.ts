import type { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { all, get, run } from './db/index.js';
import { verifyAccessToken } from './services/auth.js';

export type Authed = Request & { user: { id: number; role: string; name: string } };

export const asyncRoute = (fn: (req: any, res: Response, next: NextFunction) => any) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(Object.assign(new Error('Invalid input'), { status: 400, details: result.error.flatten() }));
    (req as any)[source] = result.data;
    next();
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = verifyAccessToken(req.cookies?.ds_access);
  if (!user) return next(Object.assign(new Error('Please sign in'), { status: 401 }));
  (req as any).user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return next(Object.assign(new Error('Please sign in'), { status: 401 }));
    if (!roles.includes(user.role)) return next(Object.assign(new Error('You do not have access to this action'), { status: 403 }));
    next();
  };
}

export const isStaff = (user: any) => user?.role === 'tutor' || user?.role === 'admin';

/** Object-level authorization: never trust a student id supplied by the client. */
export function assertStudentAccess(user: any, studentId: number) {
  if (isStaff(user)) return;
  if (user.role === 'student' && Number(user.id) === Number(studentId)) return;
  if (user.role === 'parent') {
    const link = get('SELECT id FROM parent_student_links WHERE parent_id=? AND student_id=? AND status=?', user.id, studentId, 'active');
    if (link) return;
  }
  throw Object.assign(new Error('You cannot access this student record'), { status: 403 });
}

export function assertBatchAccess(user: any, batchId: number) {
  if (isStaff(user)) return;
  const enrolled = get('SELECT id FROM enrollments WHERE batch_id=? AND student_id=? AND status=?', batchId, user.id, 'active');
  if (user.role === 'student' && enrolled) return;
  if (user.role === 'parent') {
    const childIds = all<{ student_id: number }>('SELECT student_id FROM parent_student_links WHERE parent_id=? AND status=?', user.id, 'active').map((r) => r.student_id);
    if (childIds.some((id) => get('SELECT id FROM enrollments WHERE batch_id=? AND student_id=?', batchId, id))) return;
  }
  throw Object.assign(new Error('You cannot access this batch'), { status: 403 });
}

export function assertRoomAccess(user: any, roomId: number) {
  if (isStaff(user)) return;
  const member = get('SELECT user_id FROM chat_members WHERE room_id=? AND user_id=?', roomId, user.id);
  if (member) return;
  throw Object.assign(new Error('You are not a member of this conversation'), { status: 403 });
}

/** Visible student ids for the current user. Staff see all; parents see linked children. */
export function visibleStudents(user: any): number[] {
  if (isStaff(user)) return all<{ id: number }>("SELECT id FROM users WHERE role='student'").map((r) => r.id);
  if (user.role === 'student') return [Number(user.id)];
  return all<{ student_id: number }>('SELECT student_id FROM parent_student_links WHERE parent_id=? AND status=?', user.id, 'active').map((r) => r.student_id);
}

export function audit(req: Request, action: string, target?: any) {
  try {
    const actor = (req as any).user?.id || null;
    // Never store tokens, passwords, card data or request bodies in the audit log.
    const safe = target && typeof target === 'object' ? JSON.stringify(target).slice(0, 500) : target ? String(target).slice(0, 200) : null;
    run('INSERT INTO audit_logs (actor_id,action,target,created_at) VALUES (?,?,?,?)', actor, action, safe, new Date().toISOString());
  } catch { /* audit must never break a request */ }
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  if (status >= 500) console.error('[api-error]', err?.message || 'unknown error');
  res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : err.message, details: err.details });
}
