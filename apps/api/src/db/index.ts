import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH, DATA_DIR, UPLOAD_DIR } from '../config.js';
import { SCHEMA } from './schema.js';
import { SCHEMA_PG } from './schema.postgres.js';

/**
 * Async database adapter.
 * - Local dev: better-sqlite3 with `?` placeholders.
 * - Vercel/serverless: PostgreSQL (Neon/Supabase/Vercel Postgres) with the same
 *   `?` placeholders in application code, translated to `$1..$n` here.
 */
export const DRIVER = process.env.DB_DRIVER || 'sqlite';
let sqlite: any = null;
let pool: any = null;

function pgParams(sql: string) {
  let i = 1;
  return sql.replace(/\?(\s+IS\s+NULL)/gi, (_m, rest) => `?::text${rest}`).replace(/\?/g, () => `$${i++}`);
}

/** Translate the few SQLite-isms used by the routes to PostgreSQL. */
function toPg(sql: string) {
  let out = pgParams(sql);
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s/i.test(out)) {
    out = out.replace(/^(\s*INSERT\s+)OR\s+IGNORE\s+INTO\s+/i, '$1INTO ');
    // ON CONFLICT is appended by run() below when needed.
    if (!/ON\s+CONFLICT/i.test(out)) out = out.trimEnd() + ' ON CONFLICT DO NOTHING';
  }
  return out;
}

async function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (DRIVER === 'postgres') {
    const pgModule = await import('pg');
    const { Pool } = pgModule;
    // COUNT(*) is int8 in PostgreSQL; keep it a JS number like SQLite does.
    (pgModule.default || pgModule).types?.setTypeParser(20, (v: string) => Number(v));
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('POSTGRES_URL (or DATABASE_URL) is required when DB_DRIVER=postgres');
    pool = new Pool({ connectionString, ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false }, max: 5 });
    await pool.query(SCHEMA_PG);
    // additive migration for deployments created before blob storage support
    try { await pool.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS storage_url TEXT'); } catch { /* ignore */ }
    return;
  }
  // Indirect import keeps the native SQLite module out of serverless bundles.
  const sqliteModule = 'better-sqlite3';
  const Database = (await import(sqliteModule)).default;
  sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(SCHEMA);
  try { sqlite.exec('ALTER TABLE files ADD COLUMN storage_url TEXT'); } catch { /* already present */ }
}

const ready = init();

export async function get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
  await ready;
  if (sqlite) return sqlite.prepare(sql).get(...params) as T | undefined;
  const res = await pool.query(toPg(sql), params);
  return res.rows[0] as T | undefined;
}

export async function all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
  await ready;
  if (sqlite) return sqlite.prepare(sql).all(...params) as T[];
  const res = await pool.query(toPg(sql), params);
  return res.rows as T[];
}

export async function run(sql: string, ...params: any[]) {
  await ready;
  if (sqlite) return sqlite.prepare(sql).run(...params);
  let query = toPg(sql);
  if (/^\s*INSERT\b/i.test(sql) && !/RETURNING\s/id.test(query)) query += ' RETURNING *';
  const res = await pool.query(query, params);
  return { lastInsertRowid: res.rows?.[0]?.id ?? 0, changes: res.rowCount ?? 0 };
}

export const now = () => new Date().toISOString();
export const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
export const daysFromNow = (days: number, hour = 9, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const parse = (value: any, fallback: any = null) => {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

export function row<T = any>(value: T | undefined, message = 'Not found'): T {
  if (!value) { const e: any = new Error(message); e.status = 404; throw e; }
  return value;
}
