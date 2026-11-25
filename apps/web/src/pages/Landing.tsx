import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, ChartNoAxesColumn, CheckCircle2, ClipboardCheck, GraduationCap, MessageCircle, ReceiptText, Sparkles } from 'lucide-react';

const features = [
  { icon: CalendarDays, title: 'Live & recorded classes', text: 'Join live sessions from your phone, then revisit recordings by module with playback controls and bookmarks.' },
  { icon: ClipboardCheck, title: 'Attendance made visible', text: 'Tutors mark attendance in seconds. Students and parents see a monthly view and receive absence alerts.' },
  { icon: ReceiptText, title: 'Fees without the confusion', text: 'Invoices, instalments, receipts and reminders in one clear ledger. Parents can pay from their own account.' },
  { icon: ChartNoAxesColumn, title: 'Reports that mean something', text: 'Track test scores, four language skills, homework completion and tutor remarks in a parent-friendly report card.' },
  { icon: BookOpen, title: 'Material that sticks', text: 'Vocabulary lists, grammar sheets, audio drills and flashcards organised by level and topic.' },
  { icon: MessageCircle, title: 'Privacy-first class chat', text: 'Talk with your batch and tutor using display names. Phone numbers stay private.' },
];

const courses = [
  ['A1', 'German A1 Foundation', '8 weeks', 'Start from zero and build everyday confidence.'],
  ['A2', 'German A2 Everyday', '10 weeks', 'Handle daily situations and write short messages.'],
  ['B1', 'B1 Independent', '12 weeks', 'Speak about experiences and understand clear texts.'],
  ['B2', 'B2 Upper Intermediate', '14 weeks', 'Develop fluency for work and study.'],
  ['C1', 'C1 Advanced', '16 weeks', 'Refine nuance, style and academic listening.'],
  ['EXAM', 'Exam preparation', '10–12 weeks', 'Goethe, TestDaF and telc exam practice.'],
];

const faqs = [
  { q: 'Which German levels are offered?', a: 'Courses run from A1 beginner to C1 advanced, plus Goethe, TestDaF and telc exam preparation and a weekly conversation club.' },
  { q: 'Can parents follow their child’s progress?', a: 'Yes. A linked parent account shows attendance, homework status, fees, report cards and announcements. Parents can also pay fees.' },
  { q: 'Are recorded classes available?', a: 'Every course includes a recorded lesson library organised into modules, with speed control, resume position and watched tracking.' },
  { q: 'Can students practise speaking?', a: 'Yes. Homework accepts audio recordings for speaking practice, and tutors can reply with voice feedback.' },
];

export default function Landing() {
  return <div className="min-h-screen bg-[#f7f8f5] text-ink-900 dark:bg-[#0d1614] dark:text-slate-100">
    <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><GraduationCap size={20} /></div><div><p className="text-sm font-extrabold">Deutsch Studio</p><p className="text-[10px] text-brand-600">German, made clear.</p></div></div>
        <nav className="hidden items-center gap-6 text-sm font-medium text-ink-500 md:flex dark:text-slate-300"><a href="#features" className="hover:text-brand-700">Features</a><a href="#courses" className="hover:text-brand-700">Courses</a><a href="#faq" className="hover:text-brand-700">FAQ</a></nav>
        <div className="flex items-center gap-2"><Link to="/app" className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Open app</Link></div>
      </div>
    </header>

    <main>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"><Sparkles size={14} /> Built for German learners & their families</span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">Learn German with <span className="text-brand-600">structure</span>, not scattered notes.</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-500 dark:text-slate-300 sm:text-lg">Deutsch Studio brings live classes, recordings, homework, attendance, fees and honest progress reports into one simple space for students, parents and tutors.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link to="/app" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 font-semibold text-white shadow-soft hover:bg-brand-700">Get started <ArrowRight size={17} /></Link><a href="#courses" className="inline-flex h-12 items-center rounded-xl border border-slate-200 bg-white px-6 font-semibold hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900">Explore courses</a></div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-ink-100 pt-6 dark:border-slate-800">
            {[['9', 'course tracks'], ['10K+', 'lessons delivered'], ['4.9/5', 'learner rating']].map(([n, l]) => <div key={l}><dt className="text-2xl font-extrabold text-brand-700 dark:text-brand-300">{n}</dt><dd className="text-xs text-ink-500 dark:text-slate-400">{l}</dd></div>)}
          </dl>
        </div>
        <div className="relative">
          <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-sand-200/60 blur-2xl" />
          <div className="relative rounded-3xl border border-ink-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold text-ink-500">Today · A1 Morning Batch</p><p className="text-lg font-bold">Guten Tag, Ayesha 👋</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">86% attendance</span></div>
            <div className="rounded-2xl bg-brand-600 p-4 text-white"><div className="flex items-center justify-between"><span className="text-xs font-medium text-brand-100">Live in 20 minutes</span><span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">LIVE</span></div><p className="mt-2 text-lg font-bold">Present tense practice</p><div className="mt-4 flex items-center justify-between text-xs"><span>09:00 – 10:00 AM</span><span className="rounded-lg bg-white px-3 py-1.5 font-bold text-brand-700">Join class →</span></div></div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[['3', 'homework due'], ['PKR 11,000', 'fee due'], ['4', 'new materials']].map(([n, l]) => <div key={l} className="rounded-xl border border-ink-100 p-3 dark:border-slate-800"><p className="text-sm font-extrabold">{n}</p><p className="text-[11px] text-ink-500 dark:text-slate-400">{l}</p></div>)}
            </div>
            <div className="mt-4 space-y-2">{['Listening: auf dem Markt', 'Grammar: word order'].map((x, i) => <div key={x} className="flex items-center gap-3 rounded-xl bg-ink-50 p-3 dark:bg-slate-800"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-brand-600 dark:bg-slate-900">▶</span><div className="flex-1"><p className="text-xs font-semibold">{x}</p><p className="text-[10px] text-ink-500">Lesson {i + 1} · {12 + i * 4} min</p></div><CheckCircle2 size={16} className="text-emerald-500" /></div>)}</div>
          </div>
        </div>
      </section>

      <section className="border-y border-ink-100 bg-white py-14 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-9 max-w-2xl"><p className="text-xs font-bold uppercase tracking-widest text-brand-600">Everything connected</p><h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">One place for the whole learning loop</h2></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map((f) => <div key={f.title} className="rounded-2xl border border-ink-100 p-5 dark:border-slate-800"><f.icon className="text-brand-600" size={22} /><h3 className="mt-3 font-bold">{f.title}</h3><p className="mt-1.5 text-sm leading-relaxed text-ink-500 dark:text-slate-400">{f.text}</p></div>)}</div>
        </div>
      </section>

      <section id="courses" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-brand-600">Courses</p><h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">A clear path from A1 to C1</h2></div><p className="max-w-md text-sm text-ink-500 dark:text-slate-400">Every course has a syllabus, module-wise recordings, homework and a tutor who knows your progress.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{courses.map(([code, title, duration, desc]) => <div key={code} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-extrabold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">{code}</span><span className="text-xs text-ink-500">{duration}</span></div><h3 className="mt-4 font-bold">{title}</h3><p className="mt-1.5 text-sm text-ink-500 dark:text-slate-400">{desc}</p></div>)}</div>
      </section>

      <section id="faq" className="border-t border-ink-100 bg-white py-16 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">FAQ</p><h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Questions, answered directly</h2>
          <div className="mt-8 space-y-4">{faqs.map((f) => <div key={f.q} className="rounded-2xl border border-ink-100 p-5 dark:border-slate-800"><h3 className="font-bold">{f.q}</h3><p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-slate-400">{f.a}</p></div>)}</div>
          <div className="mt-8 rounded-2xl bg-brand-50 p-5 dark:bg-brand-900/30"><p className="text-xs font-bold uppercase tracking-widest text-brand-700 dark:text-brand-200">In short</p><p className="mt-2 text-sm leading-relaxed text-brand-900 dark:text-brand-100">Deutsch Studio is a German-language coaching platform for A1–C1 courses. It combines live and recorded lessons, attendance, fees, homework, reports, study material and class chat for students, parents and tutors.</p></div>
        </div>
      </section>
    </main>

    <footer className="border-t border-ink-100 py-8 dark:border-slate-800"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-ink-500 sm:px-6"><p>© {new Date().getFullYear()} Deutsch Studio. An original demo product.</p><div className="flex gap-4"><Link to="/legal/privacy" className="hover:text-brand-700">Privacy</Link><Link to="/legal/terms" className="hover:text-brand-700">Terms</Link><a href="mailto:hello@deutschstudio.demo" className="hover:text-brand-700">Contact</a></div></div></footer>
  </div>;
}
