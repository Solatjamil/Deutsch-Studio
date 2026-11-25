import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');                 // apps/api
export const PROJECT_ROOT = path.resolve(here, '../../..');  // repo root
export const DATA_DIR = process.env.DATA_DIR || path.join(PROJECT_ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'deutsch-studio.db');

export const PORT = Number(process.env.PORT || 4000);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me-in-production-deutsch-studio';
export const REFRESH_SECRET = process.env.REFRESH_SECRET || 'dev-only-refresh-change-me-deutsch-studio';
export const ACCESS_TTL = '15m';
export const REFRESH_TTL_DAYS = 7;
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
export const DEV_OTP = process.env.DEV_OTP || '123456';

// ── Integration points ───────────────────────────────────────────────────────
// SMS: replace MockSmsProvider with an SMS provider (e.g. Twilio / MSG91) that
// implements send(phone, code). Nothing else in the app needs to change.
// Payments: replace MockPaymentGateway with Razorpay/Stripe adapter implementing
// createOrder / capture. No card data ever reaches this server.
// Storage: replace LocalStorageDriver with S3-compatible driver implementing
// put/get/url. Uploads are already isolated behind src/services/storage.ts.
// Video: lessons use plain URLs; swap in Jitsi/Zoom/Meet links in the seed or
// through the admin content manager. Push: see web/src/lib/notifications.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const BRAND = {
  name: 'Deutsch Studio',
  tagline: 'German, made clear.',
  email: 'hello@deutschstudio.demo',
  phone: '+92 300 1234567',
};
