export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS institutes (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, tagline TEXT, logo TEXT,
  colors TEXT, contact TEXT, policies TEXT, address TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, email TEXT UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','parent','tutor','admin')),
  photo_url TEXT, level TEXT, batch_id INTEGER, locale TEXT DEFAULT 'en', theme TEXT DEFAULT 'light',
  consent_at TEXT, status TEXT DEFAULT 'active', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS parent_student_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER NOT NULL REFERENCES users(id), invite_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active', created_at TEXT NOT NULL, UNIQUE(parent_id, student_id)
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, code_hash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
  level TEXT, description TEXT, syllabus TEXT, duration_weeks INTEGER, price INTEGER,
  tutor_id INTEGER REFERENCES users(id), schedule_text TEXT, exam_board TEXT, accent TEXT
);
CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL, position INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT, module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL, video_url TEXT, duration_min INTEGER DEFAULT 10, position INTEGER DEFAULT 0,
  description TEXT
);
CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, course_id INTEGER NOT NULL REFERENCES courses(id),
  start_date TEXT, end_date TEXT, tutor_id INTEGER REFERENCES users(id), schedule TEXT, capacity INTEGER DEFAULT 30
);
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL REFERENCES users(id),
  batch_id INTEGER NOT NULL REFERENCES batches(id), progress_pct INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', enrolled_at TEXT NOT NULL, UNIQUE(student_id, batch_id)
);
CREATE TABLE IF NOT EXISTS class_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, meeting_url TEXT,
  room_name TEXT, is_live INTEGER DEFAULT 0, agenda TEXT
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('present','absent','late','leave')),
  reason TEXT, marked_by INTEGER REFERENCES users(id), marked_at TEXT NOT NULL,
  UNIQUE(session_id, student_id)
);
CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL, reason TEXT NOT NULL, status TEXT DEFAULT 'pending',
  reviewed_by INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  tutor_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, instructions TEXT,
  due_at TEXT NOT NULL, max_marks INTEGER DEFAULT 10, attachments TEXT DEFAULT '[]', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id), text TEXT, files TEXT DEFAULT '[]',
  audio_url TEXT, status TEXT DEFAULT 'submitted', marks INTEGER, comments TEXT,
  voice_feedback_url TEXT, submitted_at TEXT NOT NULL, reviewed_at TEXT, reviewed_by INTEGER,
  UNIQUE(homework_id, student_id)
);
CREATE TABLE IF NOT EXISTS fee_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER NOT NULL REFERENCES courses(id),
  name TEXT NOT NULL, amount INTEGER NOT NULL, plan_type TEXT DEFAULT 'one-time',
  installments INTEGER DEFAULT 1, due_days INTEGER DEFAULT 7
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT UNIQUE NOT NULL,
  student_id INTEGER NOT NULL REFERENCES users(id), plan_id INTEGER NOT NULL REFERENCES fee_plans(id),
  amount INTEGER NOT NULL, discount INTEGER DEFAULT 0, total INTEGER NOT NULL,
  due_at TEXT NOT NULL, status TEXT DEFAULT 'pending', issued_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  student_id INTEGER NOT NULL REFERENCES users(id), amount INTEGER NOT NULL,
  method TEXT NOT NULL, gateway_ref TEXT, status TEXT DEFAULT 'success',
  paid_at TEXT NOT NULL, recorded_by INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL REFERENCES batches(id),
  title TEXT NOT NULL, duration_min INTEGER DEFAULT 20, scheduled_at TEXT, status TEXT DEFAULT 'published',
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'mcq', prompt TEXT NOT NULL, options TEXT DEFAULT '[]',
  correct_answer TEXT, marks INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS test_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER NOT NULL REFERENCES tests(id),
  student_id INTEGER NOT NULL REFERENCES users(id), answers TEXT DEFAULT '{}',
  score INTEGER DEFAULT 0, max_score INTEGER DEFAULT 0, started_at TEXT NOT NULL, submitted_at TEXT NOT NULL,
  UNIQUE(test_id, student_id)
);
CREATE TABLE IF NOT EXISTS report_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL REFERENCES users(id),
  batch_id INTEGER NOT NULL REFERENCES batches(id), period TEXT NOT NULL,
  attendance_pct INTEGER, homework_pct INTEGER, skills TEXT DEFAULT '{}',
  rank INTEGER, total_students INTEGER, remarks TEXT, generated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, type TEXT NOT NULL,
  level TEXT, topic TEXT, url TEXT, file_path TEXT, size_kb INTEGER,
  uploaded_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS material_favorites (
  user_id INTEGER NOT NULL REFERENCES users(id), material_id INTEGER NOT NULL REFERENCES materials(id),
  PRIMARY KEY(user_id, material_id)
);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL REFERENCES users(id),
  batch_id INTEGER REFERENCES batches(id), title TEXT NOT NULL, body TEXT NOT NULL,
  attachments TEXT DEFAULT '[]', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id), read_at TEXT NOT NULL,
  PRIMARY KEY(announcement_id, user_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT NOT NULL, title TEXT NOT NULL, body TEXT, data TEXT DEFAULT '{}',
  read_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id INTEGER NOT NULL REFERENCES users(id), category TEXT NOT NULL, enabled INTEGER DEFAULT 1,
  PRIMARY KEY(user_id, category)
);
CREATE TABLE IF NOT EXISTS chat_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('group','direct')),
  batch_id INTEGER REFERENCES batches(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_members (
  room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id), PRIMARY KEY(room_id, user_id)
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id), type TEXT DEFAULT 'text',
  body TEXT, file_url TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_mutes (
  room_id INTEGER NOT NULL REFERENCES chat_rooms(id), user_id INTEGER NOT NULL REFERENCES users(id),
  muted_until TEXT, PRIMARY KEY(room_id, user_id)
);
CREATE TABLE IF NOT EXISTS chat_blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id), blocked_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, PRIMARY KEY(blocker_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS message_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL REFERENCES chat_messages(id),
  reporter_id INTEGER NOT NULL REFERENCES users(id), reason TEXT, status TEXT DEFAULT 'open', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deletion_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT, status TEXT DEFAULT 'pending', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL, target TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, original_name TEXT NOT NULL,
  mime TEXT NOT NULL, size INTEGER NOT NULL, owner_id INTEGER NOT NULL REFERENCES users(id),
  purpose TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS flashcards (
  id INTEGER PRIMARY KEY AUTOINCREMENT, front TEXT NOT NULL, back TEXT NOT NULL,
  level TEXT, topic TEXT, box INTEGER DEFAULT 1, next_review TEXT
);

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_batch ON class_sessions(batch_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_room ON chat_messages(room_id, id);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id);
`;
