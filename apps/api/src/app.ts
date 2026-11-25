import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { CORS_ORIGIN, NODE_ENV, PORT, PROJECT_ROOT, UPLOAD_DIR } from './config.js';
import { all, get } from './db/index.js';
import { errorHandler, isStaff, requireAuth } from './middleware.js';
import { authRouter } from './routes/auth.js';
import { coreRouter } from './routes/core.js';
import { academicsRouter } from './routes/academics.js';
import { financeRouter } from './routes/finance.js';
import { chatRouter } from './routes/chat.js';
import { adminRouter } from './routes/admin.js';
import { readUpload } from './services/storage.js';

export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https:'],
      mediaSrc: ["'self'", 'blob:', 'https:'],
      frameSrc: ["'self'", 'https:'],
      objectSrc: ["'none'"],
    },
  },
  hsts: NODE_ENV === 'production',
}));
app.use(cors({
  origin: CORS_ORIGIN ? CORS_ORIGIN.split(',') : true,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

app.use('/api', rateLimit({ windowMs: 15 * 60000, limit: NODE_ENV === 'production' ? 400 : 10000, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests. Please slow down.' } }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60000, limit: NODE_ENV === 'production' ? 60 : 2000, standardHeaders: 'draft-7', legacyHeaders: false, skip: (r) => r.path === '/csrf', message: { error: 'Too many sign-in attempts. Please try again later.' } }));

// Double-submit CSRF token. The browser reads ds_csrf (non-httpOnly) after GET /api/auth/csrf.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookie = req.cookies?.ds_csrf;
  const header = req.headers['x-csrf-token'];
  if (!cookie || !header || cookie !== header) return res.status(403).json({ error: 'CSRF check failed. Please refresh the page.' });
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Deutsch Studio API', version: '1.0.0' }));
app.use('/api/auth', authRouter);
app.use('/api', coreRouter);
app.use('/api', academicsRouter);
app.use('/api/fees', financeRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);

app.get('/api/uploads/:name', requireAuth, async (req: any, res) => {
  const name = String(req.params.name);
  if (!/^[a-f0-9-]+\.[a-z0-9]+$/.test(name) || name.includes('..')) return res.status(400).json({ error: 'Invalid file' });
  const file = (await get<any>('SELECT * FROM files WHERE name=?', name));
  if (!file) return res.status(404).json({ error: 'File not found' });
  const owner = (await get<any>('SELECT id,role FROM users WHERE id=?', file.owner_id));
  const ownerIsStaff = owner && isStaff(owner);
  if (!isStaff(req.user) && file.owner_id !== req.user.id && !ownerIsStaff) return res.status(403).json({ error: 'Access denied' });
  res.setHeader('Content-Type', file.mime);
  res.send(await readUpload(name, file.storage_url));
});

const dist = path.join(PROJECT_ROOT, 'apps/web/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (_req, res) => res.type('html').send('<h1>Deutsch Studio API</h1><p>The web app is served by Vite on port 5173 in development.</p>'));
}

app.use(errorHandler);

