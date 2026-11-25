/** Browser loop-test: every screen for each role + critical UI flows + console/layout checks. */
import { chromium } from '@playwright/test';

const BASE = process.env.WEB_BASE || 'http://127.0.0.1:5173';
const results = [];
const consoleErrors = [];
const pageErrors = [];
let browser;

class ApiClient {
  constructor() { this.cookies = {}; this.csrf = ''; }
  async request(path, { method = 'GET', body } = {}) {
    const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${BASE}/api${path}`, { method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'x-csrf-token': this.csrf } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() || []) { const [pair] = c.split(';'); const i = pair.indexOf('='); if (i > 0) this.cookies[pair.slice(0, i)] = pair.slice(i + 1); }
    return res.json().catch(() => ({}));
  }
  async login(email) {
    await this.request('/auth/csrf');
    const csrfCookie = this.cookies.ds_csrf; this.csrf = csrfCookie;
    return this.request('/auth/password', { method: 'POST', body: { email, password: 'Demo1234!' } });
  }
}

function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : ' ' + extra}`);
}

async function csrfFrom(context) {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === 'ds_csrf')?.value || '';
}

const ACCOUNTS = {
  student: 'student1@deutschstudio.demo',
  parent: 'parent1@deutschstudio.demo',
  tutor: 'anna@deutschstudio.demo',
  admin: 'admin@deutschstudio.demo',
};
async function login(page, role) {
  await page.goto(`${BASE}/app`);
  await page.locator('h1').first().waitFor({ timeout: 10000 });
  const select = page.getByLabel('Switch demo role');
  if (await select.count()) {
    await select.selectOption(role);
    await page.waitForTimeout(800);
  }
}

async function sweep(page, role, paths) {
  console.log(`\n[ ${role} screens ]`);
  for (const path of paths) {
    await page.goto(BASE + path);
    await page.waitForTimeout(650);
    const state = await page.evaluate(() => ({
      text: document.body.innerText.slice(0, 5000),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      h1: document.querySelectorAll('h1').length,
    }));
    const broken = /Something went wrong|Request failed|CSRF check failed|Please sign in|You do not have access/.test(state.text);
    check(`${role} ${path}`, !broken && state.overflow <= 6 && state.h1 <= 1, `broken=${broken} overflow=${state.overflow} h1=${state.h1}`);
  }
}

async function run() {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160) + ' @ ' + (m.location()?.url || '').slice(-100)); });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 250)));

  console.log('\n=== Deutsch Studio UI loop test ===');
  await page.goto(BASE);
  await page.locator('h1').first().waitFor({ timeout: 10000 });
  check('Public landing renders', (await page.locator('h1').count()) === 1);
  await page.goto(`${BASE}/intro`);
  check('Onboarding renders', (await page.locator('h1').first().innerText()).includes('classes'));

  const common = ['/app', '/app/classes', '/app/courses', '/app/courses/1', '/app/homework', '/app/homework/1',
    '/app/attendance', '/app/fees', '/app/reports', '/app/materials', '/app/tests', '/app/tests/1',
    '/app/announcements', '/app/notifications', '/app/chat', '/app/profile', '/app/settings', '/app/legal/privacy'];

  await login(page, 'student');
  await sweep(page, 'student', common);

  console.log('\n[ Student critical UI flows ]');
  const tutorApi = new ApiClient(); await tutorApi.login('anna@deutschstudio.demo');
  const hw = await tutorApi.request('/homework', { method: 'POST', body: { batchId: 1, title: `UI loop ${Date.now()}`, instructions: 'Write three sentences.', dueAt: new Date(Date.now() + 86400000).toISOString(), maxMarks: 10 } });
  const hwId = hw.id;
  await page.goto(`${BASE}/app/homework/${hwId}`);
  await page.waitForTimeout(900);
  if (!await page.locator('textarea').count()) console.log('  debug body:', (await page.locator('body').innerText()).slice(0, 500));
  await page.locator('textarea').first().fill('Mein Name ist Ayesha. Ich wohne in Sahiwal.');
  await page.getByRole('button', { name: /Submit work/ }).click();
  await page.waitForTimeout(800);
  check('Student submits homework in UI', (await page.locator('body').innerText()).includes('submitted'));

  await page.goto(`${BASE}/app/fees`);
  const adminApi = new ApiClient(); await adminApi.login('admin@deutschstudio.demo');
  const invoice = await adminApi.request('/fees/invoices', { method: 'POST', body: { studentId: 4, planId: 1, amount: 1500 } });
  const invId = invoice.id; void invId;
  await page.reload(); await page.waitForTimeout(700);
  const payButtons = page.getByRole('button', { name: /Pay/ });
  check('Pay buttons visible in fee UI', await payButtons.count() > 0);
  if (await payButtons.count()) { await payButtons.first().click(); await page.waitForTimeout(400); const confirm = page.getByRole('button', { name: /Pay now/ }); if (await confirm.count()) { await confirm.click(); await page.waitForTimeout(900); } }
  check('Fee payment flow completes', !(await page.locator('body').innerText()).includes('Request failed'));

  await page.goto(`${BASE}/app/courses/1`);
  await page.waitForTimeout(600);
  const lesson = page.locator('button').filter({ hasText: 'Lesson 1 · Core ideas' }).first();
  if (await lesson.count()) await lesson.click();
  await page.waitForTimeout(600);
  check('Video lesson opens with player', await page.locator('video').count() === 1);

  await page.goto(`${BASE}/app/chat`);
  await page.waitForTimeout(700);
  await page.locator('textarea').first().fill('UI loop: hallo!');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(700);
  check('Chat message appears', (await page.locator('body').innerText()).includes('UI loop: hallo!'));

  await page.goto(`${BASE}/app/profile`);
  await page.getByRole('button', { name: /Request data deletion/ }).click();
  await page.locator('textarea').first().fill('UI loop test');
  await page.getByRole('button', { name: /Submit request/ }).click();
  await page.waitForTimeout(600);
  check('Data deletion request submits', !(await page.locator('body').innerText()).includes('Request failed'));

  await login(page, 'parent');
  await sweep(page, 'parent', common);

  await login(page, 'tutor');
  await sweep(page, 'tutor', [...common, '/app/admin']);
  console.log('\n[ Tutor critical UI flows ]');
  await page.goto(`${BASE}/app/attendance`);
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Mark all present/ }).click();
  await page.getByRole('button', { name: /Save/ }).first().click();
  await page.waitForTimeout(800);
  check('Tutor marks attendance in UI', !(await page.locator('body').innerText()).includes('Request failed'));

  await login(page, 'admin');
  await sweep(page, 'admin', [...common, '/app/admin']);

  // Desktop layout check
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/app/admin`);
  await page.waitForTimeout(700);
  const desktop = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, sidebar: !!document.querySelector('aside') }));
  check('Desktop sidebar layout', desktop.sidebar && desktop.overflow <= 6, JSON.stringify(desktop));

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n=== UI: ${passed} passed, ${failed} failed ===`);
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.slice(0, 12).forEach((e) => console.log('  ! ' + e));
  console.log(`Page errors: ${pageErrors.length}`);
  pageErrors.slice(0, 12).forEach((e) => console.log('  !! ' + e));
  if (failed || pageErrors.length) process.exitCode = 1;
}

run().catch((e) => { console.error('UI loop crashed:', e); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
