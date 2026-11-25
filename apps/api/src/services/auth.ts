import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import type { Response } from 'express';
import { ACCESS_TTL, DEV_OTP, JWT_SECRET, NODE_ENV, REFRESH_SECRET, REFRESH_TTL_DAYS } from '../config.js';
import { all, get, now, run } from '../db/index.js';

export type SafeUser = { id: number; name: string; role: string; email?: string | null; phone?: string; level?: string | null; batch_id?: number | null };
export const publicUser = (u: any): SafeUser => ({
  id: u.id, name: u.name, role: u.role, email: u.email || null, phone: u.phone,
  level: u.level || null, batch_id: u.batch_id || null,
});

const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: NODE_ENV === 'production' };

export async function issueTokens(res: Response, user: SafeUser) {
  const access = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: ACCESS_TTL });
  const refresh = jwt.sign({ id: user.id, type: 'refresh', jti: nanoid(16) }, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
  const tokenHash = bcrypt.hashSync(refresh, 8);
  (await run('INSERT INTO refresh_tokens (user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?)',
    user.id, tokenHash, new Date(Date.now() + REFRESH_TTL_DAYS * 86400000).toISOString(), now()));
  res.cookie('ds_access', access, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie('ds_refresh', refresh, { ...cookieOpts, path: '/api/auth', maxAge: REFRESH_TTL_DAYS * 86400000 });
  // Non-sensitive marker lets the SPA skip the /me call for anonymous visitors.
  res.cookie('ds_session', '1', { httpOnly: false, sameSite: 'lax', secure: NODE_ENV === 'production', maxAge: REFRESH_TTL_DAYS * 86400000 });
  return { access };
}

export async function revokeRefresh(refresh: string) {
  const rows = await all<any>('SELECT id, token_hash FROM refresh_tokens WHERE revoked_at IS NULL');
  for (const row of rows) if (bcrypt.compareSync(refresh, row.token_hash)) (await run('UPDATE refresh_tokens SET revoked_at=? WHERE id=?', now(), row.id));
}

export function verifyAccessToken(token?: string): SafeUser | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type === 'refresh') return null;
    return { id: payload.id, role: payload.role, name: payload.name };
  } catch { return null; }
}

export async function verifyRefreshToken(token?: string): Promise<SafeUser | null> {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, REFRESH_SECRET) as any;
    if (payload.type !== 'refresh') return null;
    const rows = await all<any>('SELECT user_id, token_hash, revoked_at, expires_at FROM refresh_tokens WHERE user_id=?', payload.id);
    const valid = rows.find((r) => !r.revoked_at && new Date(r.expires_at) > new Date() && bcrypt.compareSync(token, r.token_hash));
    if (!valid) return null;
    const u = await get<any>('SELECT * FROM users WHERE id=? AND status=?', payload.id, 'active');
    return u ? publicUser(u) : null;
  } catch { return null; }
}

export const hashPassword = (p: string) => bcrypt.hashSync(p, 10);
export const checkPassword = (p: string, hash: string) => bcrypt.compareSync(p, hash);

// ── SMS / OTP provider interface ──────────────────────────────────────────────
export interface SmsProvider { send(phone: string, message: string): Promise<{ ok: boolean; devCode?: string }>; }
export class MockSmsProvider implements SmsProvider {
  async send(_phone: string, message: string) {
    const code = message.match(/\b\d{6}\b/)?.[0] || DEV_OTP;
    // TODO(SMS): swap for a real provider; keep the interface unchanged.
    return { ok: true, devCode: NODE_ENV === 'production' ? undefined : code };
  }
}
export const smsProvider: SmsProvider = new MockSmsProvider();

export async function createOtp(phone: string) {
  const code = DEV_OTP;
  (await run('DELETE FROM otp_codes WHERE phone=? OR expires_at < ?', phone, now()));
  (await run('INSERT INTO otp_codes (phone,code_hash,attempts,expires_at,created_at) VALUES (?,?,0,?,?)',
    phone, bcrypt.hashSync(code, 8), new Date(Date.now() + 10 * 60000).toISOString(), now()));
  return code;
}

export async function verifyOtp(phone: string, code: string): Promise<'ok' | 'invalid' | 'expired' | 'locked'> {
  const record = await get<any>('SELECT * FROM otp_codes WHERE phone=? ORDER BY id DESC LIMIT 1', phone);
  if (!record) return 'invalid';
  if (new Date(record.expires_at) < new Date()) return 'expired';
  if (record.attempts >= 5) return 'locked';
  if (!bcrypt.compareSync(code, record.code_hash)) {
    (await run('UPDATE otp_codes SET attempts=attempts+1 WHERE id=?', record.id));
    return 'invalid';
  }
  (await run('DELETE FROM otp_codes WHERE id=?', record.id));
  return 'ok';
}

// ── Payment gateway abstraction ───────────────────────────────────────────────
export interface PaymentGateway {
  createOrder(invoiceId: number, amount: number): Promise<{ ref: string; checkoutUrl?: string; status: 'success' }>;
}
export class MockPaymentGateway implements PaymentGateway {
  async createOrder(invoiceId: number, _amount: number) {
    // TODO(PAYMENT): call Razorpay/Stripe here; return their order id and checkout URL.
    // Card details must never be posted to this server.
    return { ref: `MOCK-${invoiceId}-${Date.now()}`, status: 'success' as const };
  }
}
export const payments: PaymentGateway = new MockPaymentGateway();
