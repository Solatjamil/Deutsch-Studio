/**
 * API loop-test: critical flows, all three roles and object-level permissions.
 * Run while `npm run dev` is up:  npm test
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:4000';
const PASSWORD = 'Demo1234!';
let failures = 0, passes = 0;

function check(name, ok, extra = '') {
  if (ok) { passes++; console.log(`  ✓ ${name}`); }
  else { failures++; console.error(`  ✗ ${name} ${extra}`); }
}

class Client {
  constructor() { this.cookies = {}; this.csrf = ''; }
  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'x-csrf-token': this.csrf } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';'); const idx = pair.indexOf('=');
      if (idx > 0) this.cookies[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data };
  }
  async init() {
    const r = await this.request('/api/auth/csrf');
    this.csrf = r.data.csrfToken;
    if (!this.csrf) throw new Error('CSRF bootstrap failed');
  }
  async login(email) {
    const r = await this.request('/api/auth/password', { method: 'POST', body: { email, password: PASSWORD } });
    if (r.status !== 200) throw new Error(`Login failed for ${email}: ${r.status} ${JSON.stringify(r.data)}`);
    return r.data.user;
  }
  get(path) { return this.request(path); }
  post(path, body) { return this.request(path, { method: 'POST', body: body || {} }); }
  patch(path, body) { return this.request(path, { method: 'PATCH', body }); }
}

async function run() {
  console.log('\n=== Deutsch Studio loop test ===');
  const health = await fetch(BASE + '/api/health').then((r) => r.json());
  check('API health', health.ok === true);

  const student = new Client(); await student.init();
  const tutor = new Client(); await tutor.init();
  const parent = new Client(); await parent.init();
  const admin = new Client(); await admin.init();

  const s = await student.login('student1@deutschstudio.demo');
  const t = await tutor.login('anna@deutschstudio.demo');
  const p = await parent.login('parent1@deutschstudio.demo');
  const a = await admin.login('admin@deutschstudio.demo');
  check('student login', s.role === 'student');
  check('tutor login', t.role === 'tutor');
  check('parent login', p.role === 'parent');
  check('admin login', a.role === 'admin');

  console.log('\n[ Dashboards ]');
  for (const [name, c] of [['student', student], ['tutor', tutor], ['parent', parent], ['admin', admin]]) {
    const r = await c.get('/api/dashboard');
    check(`${name} dashboard`, r.status === 200 && !!r.data.role, JSON.stringify(r.data).slice(0, 100));
  }

  console.log('\n[ Student screens ]');
  for (const path of ['/api/courses', '/api/courses/1', '/api/batches', '/api/schedule', '/api/homework', '/api/attendance/summary', '/api/fees/summary', '/api/reports', '/api/materials', '/api/tests', '/api/announcements', '/api/notifications', '/api/chat/rooms', '/api/practice/flashcards', '/api/practice/word']) {
    const r = await student.get(path);
    check(`GET ${path}`, r.status === 200);
  }

  console.log('\n[ Parent screens ]');
  for (const path of ['/api/dashboard?childId=4', '/api/attendance/summary?studentId=4', '/api/fees/summary?studentId=4', '/api/reports?studentId=4', '/api/homework', '/api/chat/rooms']) {
    const r = await parent.get(path);
    check(`GET ${path}`, r.status === 200);
  }

  console.log('\n[ Tutor / admin screens ]');
  for (const [c, name] of [[tutor, 'tutor'], [admin, 'admin']]) {
    for (const path of ['/api/admin/overview', '/api/admin/users', '/api/admin/analytics', '/api/attendance/batch/1', '/api/homework', '/api/tests', '/api/fees/defaulters', '/api/fees/collections', '/api/chat/rooms']) {
      const r = await c.get(path);
      check(`${name} GET ${path}`, r.status === 200);
    }
  }
  const audit = await admin.get('/api/admin/audit');
  check('admin GET /api/admin/audit', audit.status === 200);
  const tutorAudit = await tutor.get('/api/admin/audit');
  check('tutor cannot read admin audit log', tutorAudit.status === 403);

  console.log('\n[ Critical flows ]');
  const attendance = await tutor.get('/api/attendance/batch/1');
  const records = (attendance.data.students || []).map((x) => ({ studentId: x.id, status: 'present', reason: '' }));
  const marked = await tutor.post('/api/attendance/batch/1', { date: new Date().toISOString().slice(0, 10), sessionId: attendance.data.session?.id, records });
  check('Tutor marks attendance', marked.status === 200 && marked.data.updated === records.length, JSON.stringify(marked.data));

  const createdHw = await tutor.post('/api/homework', {
    batchId: 1, title: `Loop test ${Date.now()}`, instructions: 'Write three sentences in German.',
    dueAt: new Date(Date.now() + 86400000).toISOString(), maxMarks: 10,
  });
  const target = createdHw.data?.id ? await tutor.get(`/api/homework/${createdHw.data.id}`) : null;
  if (target?.status === 200) {
    const submitted = await student.post(`/api/homework/${createdHw.data.id}/submit`, { text: 'Loop test submission: Ich gehe jeden Tag zur Schule.', files: [], audioUrl: null });
    check('Student submits homework', submitted.status === 200, JSON.stringify(submitted.data));
    const detail = await tutor.get(`/api/homework/${createdHw.data.id}`);
    const sub = (detail.data.submissions || []).find((x) => x.student_id === s.id);
    if (sub) {
      const reviewed = await tutor.post(`/api/submissions/${sub.id}/review`, { marks: 8, comments: 'Good progress.' });
      check('Tutor reviews homework', reviewed.status === 200);
    } else check('Tutor sees submission', false, 'submission missing');
  } else check('Tutor creates homework', false, JSON.stringify(createdHw.data));

  const plans = await admin.get('/api/fees/plans');
  const createdInvoice = await admin.post('/api/fees/invoices', { studentId: s.id, planId: plans.data[0].id, amount: 2500 });
  if (createdInvoice.status === 201) {
    const paid = await student.post('/api/fees/pay', { invoiceId: createdInvoice.data.id, method: 'mock-gateway' });
    check('Student pays fee via sandbox', paid.status === 200 && !!paid.data.ref, JSON.stringify(paid.data));
  } else check('Admin creates invoice for payment test', false, JSON.stringify(createdInvoice.data));

  const lessons = await student.get('/api/courses/1');
  const lesson = lessons.data.modules?.[0]?.lessons?.[0];
  check('Recorded lesson reachable for playback', !!lesson?.video_url);

  const rooms = await student.get('/api/chat/rooms');
  const msg = await student.post(`/api/chat/rooms/${rooms.data[0].id}/messages`, { type: 'text', body: 'Loop test: Guten Tag!' });
  check('Student sends chat message', msg.status === 201 && msg.data.sender?.name, JSON.stringify(msg.data));
  const readPrivacy = await student.get(`/api/chat/rooms/${rooms.data[0].id}/messages`);
  check('Chat messages hide phone numbers', !JSON.stringify(readPrivacy.data).includes(s.phone));

  const del = await student.post('/api/auth/delete-request', { reason: 'Loop test verification' });
  check('Delete-account request recorded', del.status === 200);

  const joined = await student.post(`/api/sessions/${(await student.get('/api/schedule')).data.find((x) => new Date(x.starts_at) > new Date())?.id}/join`);
  check('Joining class auto-marks attendance', joined.status === 200);

  console.log('\n[ Permissions / IDOR ]');
  const adminAsStudent = await student.get('/api/admin/users');
  check('Student cannot access admin endpoint', adminAsStudent.status === 403, `status ${adminAsStudent.status}`);
  const other = await student.get('/api/attendance/summary?studentId=9');
  check('Student cannot view another student attendance', other.status === 403, `status ${other.status}`);
  const parentOther = await parent.get('/api/attendance/summary?studentId=9');
  check('Parent cannot view a non-linked child', parentOther.status === 403, `status ${parentOther.status}`);
  const ownChild = await parent.get('/api/attendance/summary?studentId=4');
  check('Parent can view linked child', ownChild.status === 200);
  const csrfBypass = await fetch(BASE + '/api/homework', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  check('CSRF blocks unauthorised mutation', csrfBypass.status === 403, `status ${csrfBypass.status}`);
  const unauth = await fetch(BASE + '/api/dashboard');
  check('Unauthenticated dashboard blocked', unauth.status === 401, `status ${unauth.status}`);
  const studentAdminPost = await student.post('/api/admin/users', { name: 'Hacker', phone: '9999999999', role: 'admin' });
  check('Student cannot create users', studentAdminPost.status === 403, `status ${studentAdminPost.status}`);
  const otherInvoicePay = await student.post('/api/fees/pay', { invoiceId: 10 });
  check('Student cannot pay another student invoice', otherInvoicePay.status === 403 || otherInvoicePay.status === 404 || otherInvoicePay.status === 409, `status ${otherInvoicePay.status}`);

  console.log(`\n=== ${passes} passed, ${failures} failed ===`);
  if (failures) process.exitCode = 1;
}

run().catch((e) => { console.error('Loop test crashed:', e); process.exitCode = 1; });
