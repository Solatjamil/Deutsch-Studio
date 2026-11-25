import { app } from '../apps/api/src/app';

/**
 * Vercel serverless entry point. Vercel's Node runtime passes (req, res)
 * directly, so the Express app itself is the handler — no port binding and no
 * persistent WebSocket server. Chat falls back to REST polling in the browser.
 */
let seedPromise: Promise<unknown> | null = null;

export default async function vercelHandler(req: any, res: any) {
  // Optional one-time demo seeding. Preferred: run `npm run seed:postgres`
  // as a deployment step; keep AUTO_SEED off for normal production traffic.
  if (process.env.AUTO_SEED === 'true') {
    if (!seedPromise) {
      seedPromise = import('../apps/api/src/db/seed').catch((err) => {
        console.error('Demo seed failed:', err);
        seedPromise = null;
      });
    }
    await seedPromise;
  }
  return app(req, res);
}
