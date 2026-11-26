import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { ToastProvider } from './components/ui';
import Layout from './components/Layout';
const Landing = lazy(() => import('./pages/Landing'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));
const Classes = lazy(() => import('./pages/Classes'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Homework = lazy(() => import('./pages/Homework'));
const HomeworkDetail = lazy(() => import('./pages/HomeworkDetail'));
const Fees = lazy(() => import('./pages/Fees'));
const Reports = lazy(() => import('./pages/Reports'));
const Materials = lazy(() => import('./pages/Materials'));
const Tests = lazy(() => import('./pages/Tests'));
const TestTake = lazy(() => import('./pages/TestTake'));
const Chat = lazy(() => import('./pages/Chat'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Admin = lazy(() => import('./pages/Admin'));
const Legal = lazy(() => import('./pages/Legal'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, authError } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-ink-500">Loading Deutsch Studio…</div>;
  if (!user) return (
    <div className="grid min-h-screen place-items-center bg-ink-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-slate-900">
        <h1 className="text-lg font-extrabold text-ink-900 dark:text-white">Demo session unavailable</h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-slate-400">{authError || 'The app could not start a demo session. Check the API configuration and try again.'}</p>
        <p className="mt-2 text-xs text-ink-500 dark:text-slate-500">On Vercel, set POSTGRES_URL, JWT_SECRET and REFRESH_SECRET, then redeploy. Check the deployment Runtime Logs for /api/auth/demo if it persists.</p>
        <div className="mt-5 flex justify-center gap-3">
          <button onClick={() => location.reload()} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white">Retry</button>
          <a href="/" className="rounded-xl px-4 py-2 text-sm font-bold text-ink-600 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-slate-800">Home</a>
        </div>
      </div>
    </div>
  );
  return <>{children}</>;
}

export default function App() {
  return <BrowserRouter><I18nProvider><ToastProvider><AuthProvider>
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-ink-500">Loading page…</div>}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/intro" element={<Onboarding />} />
      <Route path="/legal/:doc" element={<Legal />} />
      <Route path="/app" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="classes" element={<Classes />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="homework" element={<Homework />} />
        <Route path="homework/:id" element={<HomeworkDetail />} />
        <Route path="fees" element={<Fees />} />
        <Route path="reports" element={<Reports />} />
        <Route path="materials" element={<Materials />} />
        <Route path="tests" element={<Tests />} />
        <Route path="tests/:id" element={<TestTake />} />
        <Route path="chat" element={<Chat />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<Admin />} />
        <Route path="legal/:doc" element={<Legal />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  </AuthProvider></ToastProvider></I18nProvider></BrowserRouter>;
}
