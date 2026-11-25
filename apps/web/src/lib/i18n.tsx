import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';

const EN: Record<string, string> = {
  home: 'Home', classes: 'Classes', homework: 'Homework', chat: 'Chat', profile: 'Profile',
  courses: 'Courses', attendance: 'Attendance', fees: 'Fees', reports: 'Reports', materials: 'Materials',
  admin: 'Admin', notifications: 'Notifications', announcements: 'Announcements', settings: 'Settings',
  logout: 'Log out', welcome: 'Welcome back', today: 'Today', upcoming: 'Upcoming',
  pendingHomework: 'Pending homework', attendanceRate: 'Attendance', feeDue: 'Fee due',
  continueWatching: 'Continue watching', latestNews: 'Latest announcement', viewAll: 'View all',
  payNow: 'Pay now', join: 'Join class', submit: 'Submit', review: 'Review', download: 'Download',
  markPresent: 'Mark all present', save: 'Save changes', cancel: 'Cancel', search: 'Search',
  noData: 'Nothing here yet', loading: 'Loading…', retry: 'Retry', offline: 'You are offline. Some features may be unavailable.',
};

const HI: Record<string, string> = {
  home: 'होम', classes: 'कक्षाएँ', homework: 'गृहकार्य', chat: 'चैट', profile: 'प्रोफ़ाइल',
  courses: 'कोर्स', attendance: 'उपस्थिति', fees: 'फीस', reports: 'रिपोर्ट', materials: 'सामग्री',
  admin: 'एडमिन', notifications: 'सूचनाएँ', announcements: 'घोषणाएँ', settings: 'सेटिंग्स',
  logout: 'लॉग आउट', welcome: 'वापसी पर स्वागत है', today: 'आज', upcoming: 'आगामी',
  pendingHomework: 'लंबित गृहकार्य', attendanceRate: 'उपस्थिति', feeDue: 'देय फीस',
  continueWatching: 'देखना जारी रखें', latestNews: 'नवीनतम घोषणा', viewAll: 'सभी देखें',
  payNow: 'अभी भुगतान करें', join: 'कक्षा में शामिल हों', submit: 'जमा करें', review: 'समीक्षा', download: 'डाउनलोड',
  markPresent: 'सभी को उपस्थित करें', save: 'बदलाव सहेजें', cancel: 'रद्द करें', search: 'खोजें',
  noData: 'अभी यहाँ कुछ नहीं है', loading: 'लोड हो रहा है…', retry: 'फिर से कोशिश करें', offline: 'आप ऑफ़लाइन हैं। कुछ सुविधाएँ उपलब्ध नहीं हो सकतीं।',
};

type I18n = { lang: string; setLang: (l: string) => void; t: (key: string) => string };
const Ctx = createContext<I18n>({ lang: 'en', setLang: () => {}, t: (k) => EN[k] || k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(localStorage.getItem('ds-lang') || 'en');
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    if (localStorage.getItem('ds-user')) {
      api.patch('/auth/profile', { locale: lang }).catch(() => {});
    }
  }, [lang]);
  const value = useMemo<I18n>(() => ({
    lang,
    setLang: (l) => { localStorage.setItem('ds-lang', l); setLangState(l); },
    t: (k) => (lang === 'hi' ? HI[k] || EN[k] || k : EN[k] || k),
  }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
