import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone } from 'lucide-react';

const DOCS: Record<string, { title: string; updated: string; sections: { h: string; p: string }[] }> = {
  privacy: {
    title: 'Privacy Policy', updated: '25 November 2026', sections: [
      { h: 'Introduction', p: 'Deutsch Studio is an original demo tutoring-management app. We collect only the information needed to deliver classes and keep parents informed. This policy explains what is stored and why.' },
      { h: 'Information we collect', p: 'Account details such as name, phone number, email address, profile photo and language level. Class records such as attendance, homework submissions, audio practice recordings, test scores and fee payment status. Messages you send in batch or direct chat, and files you upload. Notification preferences and device-level playback position for recorded lessons.' },
      { h: 'How we use it', p: 'To run classes, mark and display attendance, review homework, issue invoices, share report cards, deliver study material and operate moderated class chat. We do not sell personal information.' },
      { h: 'Sharing', p: 'Parents see only the data of children linked to their account. Tutors and admins see the batches they manage. Payment and SMS providers are abstracted behind interfaces; this demo uses a sandbox with no real external calls.' },
      { h: 'Your choices', p: 'You can edit your profile, export your data as JSON, request deletion from the Profile screen, and control notification categories in Settings. Deletion requests are reviewed by an administrator and completed within 30 days.' },
      { h: 'Security', p: 'Passwords are hashed, sessions use short-lived tokens in httpOnly cookies, mutations are protected with CSRF tokens, endpoints enforce role and object-level access, uploads are type-checked, and admin actions are audited.' },
    ],
  },
  terms: {
    title: 'Terms of Service', updated: '25 November 2026', sections: [
      { h: 'Using the service', p: 'This is a demonstration product for a German-language coaching workflow. Demo accounts and sandbox payments are provided for evaluation; no real financial transaction occurs.' },
      { h: 'Accounts', p: 'Keep your credentials private and use accurate profile information. Parents may link only to children for whom they are responsible. Tutors must respect student privacy and applicable law.' },
      { h: 'Content', p: 'Students retain ownership of their submissions. By uploading material you grant the institute permission to store it for the purpose of teaching and feedback. Do not upload unlawful or infringing content.' },
      { h: 'Availability', p: 'The demo is provided as-is. Scheduled maintenance, browser limitations or network outages may interrupt access. Critical records should be exported if needed.' },
    ],
  },
  data: {
    title: 'Data we collect & deletion', updated: '25 November 2026', sections: [
      { h: 'Personal information', p: 'Name, phone, email, photo and language level — used to identify you in classes and reports.' },
      { h: 'Learning records', p: 'Attendance, homework (text, attachments and voice notes), tests, report cards and course progress — used to measure learning and give feedback.' },
      { h: 'Financial information', p: 'Invoices, payment status and sandbox gateway reference numbers. Card numbers are never collected or stored by this app.' },
      { h: 'Communications', p: 'Batch and direct chat messages, attachments and reports — visible to conversation members and moderators only.' },
      { h: 'Requesting deletion', p: 'Open Profile → Request data deletion. An administrator reviews the request, anonymises the account and removes associated personal data within 30 days, subject to legal retention requirements.' },
    ],
  },
  about: {
    title: 'About Deutsch Studio', updated: '25 November 2026', sections: [
      { h: 'Our idea', p: 'Deutsch Studio is an original, independent demo of a tutoring-class management experience for German language learners. It is not affiliated with any existing app or institute.' },
      { h: 'What is included', p: 'Live and recorded classes, attendance, homework, fees, tests, report cards, study material, flashcards, announcements, notifications and privacy-first chat for three roles: student, parent and tutor/admin.' },
      { h: 'Version', p: 'Web app 1.0.0 · Installable PWA · Demo build.' },
    ],
  },
  contact: {
    title: 'Contact support', updated: '25 November 2026', sections: [
      { h: 'Reach us', p: 'For account help, data requests or feedback, write to hello@deutschstudio.demo or call +92 300 1234567. Support hours: Monday to Saturday, 9 AM – 6 PM.' },
      { h: 'Response time', p: 'We aim to reply within two business days. Privacy and deletion requests are acknowledged within seven days.' },
    ],
  },
};

export default function Legal() {
  const { doc } = useParams();
  const key = doc && DOCS[doc] ? doc : 'privacy';
  const data = DOCS[key];
  return <div className="min-h-screen bg-[#f7f8f5] px-4 py-10 dark:bg-[#0d1614] sm:px-6">
    <div className="mx-auto max-w-3xl"><Link to="/" className="mb-6 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-brand-700"><ArrowLeft size={14} /> Back</Link>
      <Card><h1 className="text-2xl font-extrabold sm:text-3xl">{data.title}</h1><p className="mt-1 text-xs text-ink-500">Last updated {data.updated}</p>
        <div className="mt-6 space-y-6">{data.sections.map((s) => <section key={s.h}><h2 className="text-sm font-extrabold text-brand-700 dark:text-brand-300">{s.h}</h2><p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-slate-300">{s.p}</p></section>)}</div>
        <div className="mt-8 flex flex-wrap gap-3 border-t border-ink-100 pt-5 text-xs dark:border-slate-800"><Link to="/legal/privacy" className="font-semibold text-brand-600">Privacy</Link><Link to="/legal/terms" className="font-semibold text-brand-600">Terms</Link><Link to="/legal/data" className="font-semibold text-brand-600">Data & deletion</Link><Link to="/legal/contact" className="font-semibold text-brand-600">Contact</Link></div>
      </Card>
      <p className="mt-4 text-center text-xs text-ink-500">Deutsch Studio · German, made clear.</p>
    </div>
  </div>;
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl border border-ink-100 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900 sm:p-9">{children}</div>;
}
