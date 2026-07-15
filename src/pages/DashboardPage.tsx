import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import { API_URL, authHeader } from '../lib/api';

const fc = (n: number | null | undefined) => {
  const v = Number.isFinite(Number(n)) ? Number(n) : 0;
  return `UGX ${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

interface TodayStats {
  revenue: number;
  profit: number;
  expenses: number;
  transactions: number;
  cashSales: number;
  creditSales: number;
}

interface LowStockProduct { id: string; name: string; stock: number }

export default function DashboardPage() {
  const { user } = useAuth();
  const [today, setToday]       = useState<TodayStats | null>(null);
  const [weekRev, setWeekRev]   = useState<number>(0);
  const [monthRev, setMonthRev] = useState<number>(0);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [outstanding, setOutstanding] = useState<number>(0);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!user) return;
    const h = authHeader();
    const now = new Date();

    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999);

    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7); weekStart.setHours(0,0,0,0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);

    const enc = encodeURIComponent;

    const load = async () => {
      setLoading(true);
      try {
        const [sToday, sWeek, sMonth, eToday, credStats, lsRes] = await Promise.all([
          fetch(`${API_URL}/sales/range?startDate=${enc(todayStart.toISOString())}&endDate=${enc(todayEnd.toISOString())}`, { headers: h }).then(r => r.ok ? r.json() : []),
          fetch(`${API_URL}/sales/range?startDate=${enc(weekStart.toISOString())}&endDate=${enc(todayEnd.toISOString())}`, { headers: h }).then(r => r.ok ? r.json() : []),
          fetch(`${API_URL}/sales/range?startDate=${enc(monthStart.toISOString())}&endDate=${enc(monthEnd.toISOString())}`, { headers: h }).then(r => r.ok ? r.json() : []),
          fetch(`${API_URL}/expenses/by-date-range?startDate=${enc(todayStart.toISOString())}&endDate=${enc(todayEnd.toISOString())}`, { headers: h }).then(r => r.ok ? r.json() : []),
          fetch(`${API_URL}/credits/stats`, { headers: h }).then(r => r.ok ? r.json() : { totalOutstanding: 0 }),
          fetch(`${API_URL}/products/low-stock`, { headers: h }).then(r => r.ok ? r.json() : []),
        ]);

        const active = (arr: any[]) => arr.filter((s: any) => s.status !== 'voided');
        const sumAmt  = (arr: any[]) => arr.reduce((s: number, x: any) => s + Number(x.totalAmount), 0);
        const sumProfit = (arr: any[]) => arr.reduce((s: number, x: any) =>
          s + (Number(x.unitPrice) - Number(x.product?.buyingPrice ?? 0)) * Number(x.quantity), 0);

        const todayActive = active(sToday);
        setToday({
          revenue:      sumAmt(todayActive),
          profit:       sumProfit(todayActive),
          expenses:     eToday.reduce((s: number, e: any) => s + Number(e.amount), 0),
          transactions: todayActive.length,
          cashSales:    todayActive.filter((s: any) => s.paymentType === 'cash').reduce((s: number, x: any) => s + Number(x.totalAmount), 0),
          creditSales:  todayActive.filter((s: any) => s.paymentType === 'credit').reduce((s: number, x: any) => s + Number(x.totalAmount), 0),
        });
        setWeekRev(sumAmt(active(sWeek)));
        setMonthRev(sumAmt(active(sMonth)));
        setOutstanding(Number(credStats.totalOutstanding ?? 0));
        setLowStock(Array.isArray(lsRes) ? lsRes.slice(0, 5) : []);
      } catch {/* silent */}
      finally { setLoading(false); }
    };
    load();
  }, [user?.id]);

  const netToday = useMemo(() => today ? today.profit - today.expenses : 0, [today]);
  const greet = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  return (
    <PageShell title="Dashboard" description="Today's performance at a glance.">
      <div className="space-y-6">

        {/* Hero */}
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-600 p-5 sm:p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-200">{greet}</p>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold">{user?.name ?? 'Merchant'}</h2>
              <p className="mt-2 text-sm text-slate-300">Here's how your shop is doing today.</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur min-w-[110px]">
                <p className="text-xs text-brand-200 uppercase tracking-wide">Transactions</p>
                <p className="mt-1 text-2xl font-bold">{today?.transactions ?? 0}</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 backdrop-blur min-w-[110px] ${netToday >= 0 ? 'border-emerald-400/30 bg-emerald-500/20' : 'border-red-400/30 bg-red-500/20'}`}>
                <p className="text-xs text-slate-300 uppercase tracking-wide">Net today</p>
                <p className={`mt-1 text-xl font-bold ${netToday >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fc(netToday)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Low stock + outstanding credits alert bar */}
        {!loading && (lowStock.length > 0 || outstanding > 0) && (
          <div className="flex flex-col sm:flex-row gap-3">
            {lowStock.length > 0 && (
              <Link to="/restock" className="flex-1 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition">
                <span className="text-xl">⚠️</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-800">{lowStock.length} product{lowStock.length > 1 ? 's' : ''} low/out of stock</p>
                  <p className="text-xs text-amber-600 truncate">{lowStock.map(p => p.name).join(', ')}</p>
                </div>
                <span className="ml-auto text-xs font-semibold text-amber-700 shrink-0">Restock →</span>
              </Link>
            )}
            {outstanding > 0 && (
              <Link to="/credits" className="flex-1 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 hover:bg-red-100 transition">
                <span className="text-xl">💰</span>
                <div>
                  <p className="text-sm font-semibold text-red-800">Outstanding credit debt</p>
                  <p className="text-xs text-red-600">{fc(outstanding)} owed to you</p>
                </div>
                <span className="ml-auto text-xs font-semibold text-red-700 shrink-0">View →</span>
              </Link>
            )}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">Loading dashboard…</div>
        ) : (
          <>
            {/* Today KPIs */}
            <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Revenue today</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{fc(today?.revenue)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <p className="text-xs text-emerald-700 uppercase tracking-wide">Gross profit</p>
                <p className="mt-1 text-xl font-bold text-emerald-900">{fc(today?.profit)}</p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
                <p className="text-xs text-red-600 uppercase tracking-wide">Expenses today</p>
                <p className="mt-1 text-xl font-bold text-red-700">{fc(today?.expenses)}</p>
              </div>
              <div className={`rounded-2xl border p-4 shadow-sm ${netToday >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <p className={`text-xs uppercase tracking-wide ${netToday >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Net profit</p>
                <p className={`mt-1 text-xl font-bold ${netToday >= 0 ? 'text-emerald-900' : 'text-red-700'}`}>{fc(netToday)}</p>
              </div>
            </section>

            {/* Cash flow today */}
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">Cash in</p>
                <p className="mt-1 text-lg font-bold text-emerald-900">{fc(today?.cashSales)}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs text-amber-700">Credit sales</p>
                <p className="mt-1 text-lg font-bold text-amber-900">{fc(today?.creditSales)}</p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-xs text-red-600">Money out (expenses)</p>
                <p className="mt-1 text-lg font-bold text-red-800">{fc(today?.expenses)}</p>
              </div>
            </section>

            {/* Performance + quick links */}
            <section className="grid gap-6 lg:grid-cols-2">
              {/* Period performance */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-3">Performance</p>
                <div className="space-y-2">
                  {[
                    { label: 'This week revenue', value: fc(weekRev) },
                    { label: 'This month revenue', value: fc(monthRev) },
                    { label: 'Outstanding credits', value: fc(outstanding) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                      <span className="text-sm text-slate-500">{label}</span>
                      <span className="text-sm font-semibold text-slate-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick links */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-3">Quick actions</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'New sale',    sub: 'Record a transaction', to: '/sales' },
                    { label: 'Credits',     sub: 'Who owes you money', to: '/credits' },
                    { label: 'Restock',     sub: 'Add stock to products', to: '/restock' },
                    { label: 'Reports',     sub: 'Daily & monthly view', to: '/reports' },
                    { label: 'Expenses',    sub: 'Record a cost', to: '/expenses' },
                    { label: 'Receipts',    sub: 'Print/share receipts', to: '/receipts' },
                  ].map(({ label, sub, to }) => (
                    <Link key={to} to={to} className="rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-brand-200 hover:bg-brand-50 transition">
                      <p className="text-sm font-semibold text-slate-900">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
