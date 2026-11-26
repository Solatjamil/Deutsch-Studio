import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = { ...process.env };

function run(args, extraEnv = {}) {
  const result = spawnSync(npm, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...env, ...extraEnv },
  });
  return result.status === 0;
}

if (!run(['run', 'build'])) process.exit(1);

const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.warn('\n⚠ No POSTGRES_URL/DATABASE_URL found. The API needs a managed Postgres database on Vercel.');
  process.exit(0);
}

console.log('\nSeeding demo data into the configured Postgres database…');
if (!run(['run', 'seed:postgres'], { DB_DRIVER: 'postgres' })) {
  console.warn('\n⚠ Demo seeding failed. Check POSTGRES_URL, database permissions and Vercel build logs.');
  console.warn('  The app will retry on the first demo login, but Hobby functions may time out.');
}
