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
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-ink-500">Loading Deutsch Studio…</div>;
  if (!user) return <Navigate to="/" replace />;
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
