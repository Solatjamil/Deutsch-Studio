import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, ChartNoAxesColumn, GraduationCap } from 'lucide-react';
import { Button } from '../components/ui';

const slides = [
  { icon: CalendarDays, title: 'Your classes, in one place', text: 'See today’s schedule, join live lessons and pick up exactly where you left off in recordings.', color: 'from-brand-500 to-brand-700' },
  { icon: BookOpen, title: 'Practice that fits your day', text: 'Submit homework with text, photos or voice notes. Save vocabulary, grammar sheets and flashcards for later.', color: 'from-sand-400 to-sand-600' },
  { icon: ChartNoAxesColumn, title: 'Progress everyone can see', text: 'Attendance, fees, reports and tutor feedback stay transparent for students and parents alike.', color: 'from-emerald-500 to-brand-700' },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const slide = slides[index];
  const Icon = slide.icon;
  return <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
    <div className="flex items-center justify-between px-5 py-5"><div className="flex items-center gap-2 font-extrabold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><GraduationCap size={18} /></span>Deutsch Studio</div><Link to="/app" className="text-sm font-semibold text-ink-500 hover:text-brand-700">Skip</Link></div>
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10 text-center">
      <div className={`grid h-28 w-28 place-items-center rounded-[2rem] bg-gradient-to-br ${slide.color} text-white shadow-soft`}><Icon size={52} strokeWidth={1.6} /></div>
      <h1 className="mt-9 max-w-md text-3xl font-extrabold tracking-tight">{slide.title}</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500 dark:text-slate-400">{slide.text}</p>
      <div className="mt-8 flex gap-2">{slides.map((_, i) => <button key={i} aria-label={`Go to slide ${i + 1}`} onClick={() => setIndex(i)} className={`h-2 rounded-full transition-all ${i === index ? 'w-7 bg-brand-600' : 'w-2 bg-slate-300 dark:bg-slate-700'}`} />)}</div>
    </div>
    <div className="mx-auto flex w-full max-w-md gap-3 px-6 pb-10">
      {index > 0 && <Button variant="outline" onClick={() => setIndex(index - 1)} className="flex-1">Back</Button>}
      <Button onClick={() => index < slides.length - 1 ? setIndex(index + 1) : navigate('/app')} className="flex-1">{index < slides.length - 1 ? <>Next <ArrowRight size={16} /></> : 'Get started'}</Button>
    </div>
  </div>;
}
