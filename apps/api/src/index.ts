import http from 'node:http';
import { app } from './app.js';
import { get } from './db/index.js';
import { attachChatWebSocket } from './routes/chat.js';
import { runSeed } from './db/seed.js';

// Local/dev server only. Vercel uses api/index.ts with the same Express app.
runSeed().catch((err) => console.error('Seed failed:', err));

const PORT = Number(process.env.PORT || 4000);
const server = http.createServer(app);
attachChatWebSocket(server);

server.listen(PORT, '0.0.0.0', async () => {
  const users = (await get<{ n: number }>('SELECT COUNT(*) n FROM users'))?.n || 0;
  console.log(`Deutsch Studio API listening on http://0.0.0.0:${PORT} · ${users} demo users ready`);
});
