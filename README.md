# Deutsch Studio

An original, mobile-first **German-language tutoring class management PWA** for students, parents and tutors/admins. It covers the full learning loop: live and recorded classes, attendance, homework with voice submissions, fees, tests, report cards, study material, announcements, notifications and privacy-first class chat.

> **Branding note:** this is an independent demo product. It does not reproduce the name, logo, screenshots, copy or proprietary assets of any existing Google Play app. The feature scope is intentionally similar to a tutoring-management platform; the identity and implementation are original.

---

## Quick start

Requires **Node.js 20+**.

```bash
cd deutsch-studio
npm install
npm run dev
```

Open **http://localhost:5173**. The API runs on **http://localhost:4000** (`/api` is proxied by Vite). The database is created and seeded automatically on first run.

Production-style run:

```bash
npm run build
npm start          # serves the built PWA and API together on port 4000
```

Reset demo data any time:

```bash
npm run reset
```

## No-login demo access

There is **no login screen**. Opening the app automatically starts a real server session for the Student demo account. Use the **role selector in the top bar** (or Profile → Switch demo role) to jump between Student, Parent, Tutor and Admin instantly.

| Role | Seeded account | What to try |
|---|---|---|
| Student | Ayesha Khan | Dashboard, join class, submit homework with audio, pay fee, watch recordings, take a test, chat |
| Parent | Parent of Ayesha | Child switcher, read-only attendance/fees/reports, pay a fee, announcements |
| Tutor | Anna Keller | Mark attendance, review homework, schedule class, post announcement, create test |
| Admin | Studio Admin | Everything above plus users, CSV import, content manager, analytics, settings, audit, moderation |

The password/OTP endpoints still exist for API demos (password `Demo1234!`, OTP `123456`), but the UI does not show them. Set `DEMO_AUTO_LOGIN=false` in the environment to disable the shortcut for a non-demo deployment. Parent invite codes are `LINK-DEMO-01` … `LINK-DEMO-05`.

---

## What is included

**Student** — role dashboard, today's classes with join + auto attendance, pending homework, monthly attendance heatmap, fee ledger with sandbox payment, report card with skill radar and score trend, course catalogue, module-wise video library with 0.75×–2× speed / bookmarks / resume / watched tracking, materials with favourites and offline cache, flashcards, daily word, grammar quiz, timed MCQ tests, batch chat (display names only), announcements, notification centre, profile, data export and deletion request.

**Parent** — linked child switcher, read-only attendance / homework / fees / reports / announcements, fee payment, child-specific dashboard and leave visibility. Cannot see other students' records.

**Tutor / Admin** — schedule builder, attendance marking with bulk actions and CSV export, homework creation and review with marks / comments / voice feedback, tests and MCQ publishing, fee defaulters, cash payments, reminders and collection charts, user and batch management, CSV student import, course/module/lesson/material content manager, announcements with read receipts, audit log, deletion-request and chat-report moderation, institute settings, analytics.

**Platform** — installable PWA (manifest + service worker + offline material cache), responsive mobile bottom nav / desktop sidebar, English + Hindi UI structure, light/dark theme, skeleton / empty / error / offline states, 44px+ touch targets, semantic labels and high-contrast palette.

---

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS, React Router, Recharts, `vite-plugin-pwa`.
- **Backend:** Node.js + Express + TypeScript (`tsx`), REST + WebSocket chat, SQLite via `better-sqlite3`.
- **Storage & auth:** local file storage behind an interface, bcrypt hashes, JWT access + rotating refresh tokens in httpOnly cookies, double-submit CSRF, Zod validation, helmet/CSP, rate limits.

**Why this stack:** one TypeScript codebase with a fast, installable PWA front end and a small, dependency-light API that can be demoed locally with zero external services. SQLite plus a deterministic seed script makes every screen populated on first run while keeping the data model close to a relational production schema. Provider interfaces for SMS, payments, file storage and video mean production adapters can be dropped in without rewriting business logic.

---

## Folder structure

```
deutsch-studio/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── config.ts              # env, brand and integration-point notes
│   │       ├── db/{index,schema,seed}.ts
│   │       ├── middleware.ts          # auth, RBAC, object-level checks, audit, errors
│   │       ├── services/              # auth/OTP, payments, storage abstractions
│   │       └── routes/                # auth, core, academics, finance, chat, admin
│   └── web/
│       ├── public/                    # original SVG logo, PNG icons, OG image, robots, sitemap
│       └── src/
│           ├── components/            # AppShell, UI kit
│           ├── lib/                   # API client, auth, i18n, notifications, utils
│           └── pages/                 # lazy-loaded screens
├── scripts/{loop-test,ui-loop}.mjs    # automated loop tests
├── data/                              # SQLite DB and uploads (gitignored)
└── README.md
```

### Integration points

Search for `TODO(SMS)`, `TODO(PAYMENT)`, `TODO(Storage)` and `Push provider` in the source:

- **SMS / OTP** — `MockSmsProvider` implements `SmsProvider`; replace with a real SMS service. The dev code is shown only because this is a sandbox.
- **Payments** — `MockPaymentGateway` implements `PaymentGateway`; swap in Razorpay/Stripe. No card data is ever sent to or stored by this server.
- **File storage** — `saveUpload()` in `services/storage.ts`; swap the local driver for S3-compatible storage. Uploads are type/size checked, randomly named and malware-scan hooked.
- **Video** — lesson URLs and live meeting URLs are plain fields; Jitsi links are seeded. Replace with your provider's URLs in the content manager.
- **Push** — `apps/web/src/lib/notifications.ts` schedules class reminders through the service worker; add your push subscription provider there.

---

## Security and privacy

- Server-side RBAC (`requireRole`) **and** object-level authorization (`assertStudentAccess`, `assertBatchAccess`, `assertRoomAccess`) on every sensitive endpoint — hiding UI controls is not the only defence.
- Zod input validation, parameterised SQL only, output encoding by React, strict cookie settings, double-submit CSRF token on all mutations, helmet security headers and CSP, CORS configuration, rate limits and OTP attempt/expiry limits.
- Passwords hashed with bcrypt; short-lived access tokens and rotating refresh tokens stored as hashes with revocation; no PII or tokens in logs; audit log for admin actions.
- Uploads allow only PDF/images/audio/video/csv/text with extension + MIME checks, 10 MB cap, random names and a malware-scan hook; executables and scripts are rejected.
- Data collected: name, phone, email, photo, level; attendance, homework, audio, test and fee records; chat messages and attachments; notification preferences. All are documented in the in-app **Data we collect** screen and downloadable via **Profile → Export my data**. Deletion requests are recorded in-app and processed by an admin.

---

## SEO / AEO / GEO

Only the public landing page is indexable. It has one H1, a logical heading hierarchy, meta title/description, canonical URL, Open Graph image, `EducationalOrganization` / `Course` / `FAQPage` JSON-LD, `robots.txt`, `sitemap.xml`, alt text and direct question-and-answer FAQ copy. A short factual summary block is included for generative engines. App routes inject `noindex, nofollow` at runtime and `robots.txt` disallows `/app/`.

---

## Loop tests

Two automated passes are included (the browser pass needs `npx playwright install chromium` once):

```bash
npm test          # API: all roles, all screens, critical flows, RBAC/IDOR/CSRF
npm run test:ui   # Browser: role-switcher click-through of every screen for 3 roles, critical flows,
                  # mobile + desktop layout, console and page-error checks
npm run test:all  # both
```

Latest verified result: **67/67 API checks passed** and **84/84 browser checks passed**, with zero console errors, zero page errors and no horizontal overflow at 390 px. The API pass is idempotent (it creates its own homework and invoice fixtures).

---

## Known limitations / next steps

1. **Demo data only** — SMS, payments, video meetings and push are sandbox implementations; production needs the provider adapters noted above.
2. **SQLite demo database** — suitable for a single-instance demo; production should use PostgreSQL with the same schema shapes and migrations.
3. **Chat blocking is one-sided** — blocked users are hidden from the blocker's client; a production system needs two-way moderation and abuse analytics.
4. **Audio playback position is per-device** — video resume and bookmarks use `localStorage`; syncing them to the API would be needed for cross-device continuity.
5. **Offline video** uses the Cache API where supported; large media and range requests need a more robust strategy (e.g. HLS + service worker streaming).
6. **No full Lighthouse run** in this environment; routes are code-split and assets are small, but a production audit should be run after real content is added.
7. **Branding is deliberately original** — "Deutsch Studio" is configurable in `apps/api/src/config.ts` and `apps/web/vite.config.ts` / `index.html`; no third-party assets are bundled.
