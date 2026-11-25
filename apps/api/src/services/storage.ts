import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { UPLOAD_DIR } from '../config.js';
import { run } from '../db/index.js';

/** File storage abstraction. Local driver for the demo; S3-compatible driver can
 *  replace saveUpload()/publicUrl() without touching route code. */
const ALLOWED: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'],
  'audio/wav': ['.wav'], 'audio/mpeg': ['.mp3'], 'audio/ogg': ['.ogg'], 'audio/webm': ['.webm'],
  'video/mp4': ['.mp4'], 'text/csv': ['.csv'], 'text/plain': ['.txt'],
};
const BLOCKED_EXT = new Set(['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.ts', '.html', '.svg', '.jar', '.msi', '.dll']);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXT.has(ext) || !ALLOWED[file.mimetype] || !ALLOWED[file.mimetype].includes(ext)) {
      return cb(Object.assign(new Error('Unsupported file type. PDF, images, audio and video are allowed.'), { status: 400 }));
    }
    cb(null, true);
  },
});

/** Malware-scan hook: plug in ClamAV or a cloud scanner here before persisting. */
async function scanFile(_buffer: Buffer): Promise<boolean> { return true; }

export async function saveUpload(file: Express.Multer.File, ownerId: number, purpose = 'general') {
  if (!(await scanFile(file.buffer))) throw Object.assign(new Error('File rejected by security scan'), { status: 400 });
  const ext = path.extname(file.originalname).toLowerCase();
  const name = `${randomUUID()}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer, { mode: 0o600 });
  run('INSERT INTO files (name,original_name,mime,size,owner_id,purpose,created_at) VALUES (?,?,?,?,?,?,?)',
    name, file.originalname.slice(0, 200), file.mimetype, file.size, ownerId, purpose, new Date().toISOString());
  return { name, url: `/api/uploads/${name}`, originalName: file.originalname, size: file.size };
}
