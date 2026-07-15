import { useMemo, useState } from 'react';
import PageShell from '../components/PageShell';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthDays = useMemo(() => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startOffset = firstDay.getDay();
    const cells: Array<{ date: number; inMonth: boolean }> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push({ date: 0, inMonth: false });
    }

    for (let date = 1; date <= lastDay.getDate(); date += 1) {
      cells.push({ date, inMonth: true });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date: 0, inMonth: false });
    }

    return cells;
  }, [currentDate]);

  return (
    <PageShell title="Calendar" description="A simple view for planning your shop activity.">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
            <p className="text-sm text-slate-500">Track your daily shop rhythm</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-2" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
              ←
            </button>
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-2" onClick={() => setCurrentDate(new Date())}>
              Today
            </button>
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-2" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
              →
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2">
          {days.map((day) => (
            <div key={day} className="text-center text-sm font-semibold text-slate-500">
              {day}
            </div>
          ))}
          {monthDays.map((cell, index) => (
            <div key={`${cell.date}-${index}`} className={`min-h-20 rounded-xl border border-slate-200 p-2 ${cell.inMonth ? 'bg-white' : 'bg-slate-100 text-slate-400'}`}>
              {cell.date ? <p className="text-sm font-medium">{cell.date}</p> : null}
              {cell.inMonth && cell.date === new Date().getDate() ? (
                <div className="mt-2 rounded bg-brand-500 px-2 py-1 text-[11px] text-white">Today</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
