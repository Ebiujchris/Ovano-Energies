import { useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/api';
import { printHtml } from '../lib/print';

const fmt = (n: number) =>
  `UGX ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

interface SaleRecord {
  id: string;
  status?: string;
  paymentType: string;
  totalAmount: number;
  unitPrice: number;
  quantity: number;
  customerName?: string;
  product?: { name: string; buyingPrice?: number };
  createdAt: string;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  description?: string;
  expenseDate: string;
}

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'annually';

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}
function getWeekRange(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay()); // Sunday
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: 'daily',    label: 'Daily' },
  { key: 'weekly',   label: 'Weekly' },
  { key: 'monthly',  label: 'Monthly' },
  { key: 'annually', label: 'Annual' },
];

// ─── Shared report stats panel ────────────────────────────────────────────────

function StatsPanel({ sales, expenses }: { sales: SaleRecord[]; expenses: Expense[] }) {
  const stats = useMemo(() => {
    const active = sales.filter((s) => s.status !== 'voided');
    const revenue = active.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const profit = active.reduce((sum, s) => {
      const buy = Number(s.product?.buyingPrice ?? 0);
      return sum + (Number(s.unitPrice) - buy) * Number(s.quantity);
    }, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netProfit = profit - totalExpenses;
    const cashSales = active.filter((s) => s.paymentType === 'cash').reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const creditSales = active.filter((s) => s.paymentType === 'credit').reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const mobileSales = active.filter((s) => s.paymentType === 'mobile_money').reduce((sum, s) => sum + Number(s.totalAmount), 0);
    return { revenue, profit, totalExpenses, netProfit, transactions: active.length, cashSales, creditSales, mobileSales };
  }, [sales, expenses]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales.filter((s) => s.status !== 'voided').forEach((s) => {
      const name = s.product?.name ?? 'Unknown';
      if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
      map[name].qty += Number(s.quantity);
      map[name].revenue += Number(s.totalAmount);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [sales]);

  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    sales.filter((s) => s.status !== 'voided' && s.customerName).forEach((s) => {
      const name = s.customerName!;
      if (!map[name]) map[name] = { name, total: 0, count: 0 };
      map[name].total += Number(s.totalAmount);
      map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [sales]);

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] ?? 0) + Number(e.amount); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  if (stats.transactions === 0 && expenses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
        No activity recorded in this period.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Revenue',     value: fmt(stats.revenue),      color: 'border-slate-200 bg-white' },
          { label: 'Gross Profit',value: fmt(stats.profit),       color: 'border-emerald-200 bg-emerald-50' },
          { label: 'Expenses',    value: fmt(stats.totalExpenses), color: 'border-red-200 bg-red-50' },
          { label: 'Net Profit',  value: fmt(stats.netProfit),    color: stats.netProfit >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50' },
        ].map((card) => (
          <div key={card.label} className={`rounded-2xl border p-5 ${card.color}`}>
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Payment breakdown */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Transactions</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{stats.transactions}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm text-emerald-700">Cash</p>
          <p className="mt-2 text-xl font-semibold text-emerald-900">{fmt(stats.cashSales)}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-700">Credit</p>
          <p className="mt-2 text-xl font-semibold text-amber-900">{fmt(stats.creditSales)}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm text-blue-700">Mobile Money</p>
          <p className="mt-2 text-xl font-semibold text-blue-900">{fmt(stats.mobileSales)}</p>
        </div>
      </div>

      {/* Insights grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Best sellers</h3>
          {topProducts.length === 0 ? <p className="mt-4 text-sm text-slate-400">No sales in this period.</p> : (
            <div className="mt-4 space-y-2">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                    <p className="text-sm text-slate-800 truncate">{p.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900">{fmt(p.revenue)}</p>
                    <p className="text-xs text-slate-400">{p.qty} units</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Top customers</h3>
          {topCustomers.length === 0 ? <p className="mt-4 text-sm text-slate-400">No named customers.</p> : (
            <div className="mt-4 space-y-2">
              {topCustomers.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                    <p className="text-sm text-slate-800 truncate">{c.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900">{fmt(c.total)}</p>
                    <p className="text-xs text-slate-400">{c.count} orders</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Expenses by category</h3>
          {expensesByCategory.length === 0 ? <p className="mt-4 text-sm text-slate-400">No expenses in this period.</p> : (
            <div className="mt-4 space-y-2">
              {expensesByCategory.map(([cat, total]) => (
                <div key={cat} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-700 capitalize">{cat.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-semibold text-red-600">{fmt(total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);

  const [viewMode, setViewMode] = useState<ViewMode>('daily');

  // Daily
  const [calYear, setCalYear]       = useState(today.getFullYear());
  const [calMonth, setCalMonth]     = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const stripRef = useRef<HTMLDivElement>(null);

  // Weekly
  const [weekAnchor, setWeekAnchor] = useState<Date>(today);

  // Monthly
  const [monthYear, setMonthYear]   = useState(today.getFullYear());
  const [monthIdx, setMonthIdx]     = useState(today.getMonth());

  // Annual
  const [annualYear, setAnnualYear] = useState(today.getFullYear());

  // Data
  const [sales, setSales]       = useState<SaleRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const authHeader = useMemo(() => ({
    Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`,
  }), [user?.id]);

  // Scroll today into view when calendar opens
  useEffect(() => {
    if (viewMode !== 'daily') return;
    setTimeout(() => {
      const el = stripRef.current?.querySelector('[data-today="true"]') as HTMLElement | null;
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 150);
  }, [calMonth, calYear, viewMode]);

  // Compute range based on view mode
  const range = useMemo((): { start: Date; end: Date } => {
    if (viewMode === 'daily') {
      const s = new Date(selectedDate); s.setHours(0, 0, 0, 0);
      const e = new Date(selectedDate); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    if (viewMode === 'weekly') {
      return getWeekRange(weekAnchor);
    }
    if (viewMode === 'monthly') {
      const s = new Date(monthYear, monthIdx, 1, 0, 0, 0, 0);
      const e = new Date(monthYear, monthIdx + 1, 0, 23, 59, 59, 999);
      return { start: s, end: e };
    }
    // annually
    const s = new Date(annualYear, 0, 1, 0, 0, 0, 0);
    const e = new Date(annualYear, 11, 31, 23, 59, 59, 999);
    return { start: s, end: e };
  }, [viewMode, selectedDate, weekAnchor, monthYear, monthIdx, annualYear]);

  // Load data whenever range changes
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true); setError(null);
        const [sRes, eRes] = await Promise.all([
          fetch(`${API_URL}/sales/range?startDate=${encodeURIComponent(range.start.toISOString())}&endDate=${encodeURIComponent(range.end.toISOString())}`, { headers: authHeader }),
          fetch(`${API_URL}/expenses/by-date-range?startDate=${encodeURIComponent(range.start.toISOString())}&endDate=${encodeURIComponent(range.end.toISOString())}`, { headers: authHeader }),
        ]);
        setSales(sRes.ok ? await sRes.json() : []);
        setExpenses(eRes.ok ? await eRes.json() : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [range, user?.id]);

  // Period label for header & print
  const periodLabel = useMemo(() => {
    if (viewMode === 'daily') {
      return selectedDate.toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (viewMode === 'weekly') {
      const { start, end } = getWeekRange(weekAnchor);
      return `${start.toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (viewMode === 'monthly') {
      return `${MONTHS_FULL[monthIdx]} ${monthYear}`;
    }
    return `Year ${annualYear}`;
  }, [viewMode, selectedDate, weekAnchor, monthIdx, monthYear, annualYear]);

  // Navigation helpers
  const prevWeek = () => { const d = new Date(weekAnchor); d.setDate(d.getDate() - 7); setWeekAnchor(d); };
  const nextWeek = () => { const d = new Date(weekAnchor); d.setDate(d.getDate() + 7); if (d <= today) setWeekAnchor(d); };
  const prevMonthNav = () => { if (monthIdx === 0) { setMonthYear(y => y - 1); setMonthIdx(11); } else setMonthIdx(m => m - 1); };
  const nextMonthNav = () => {
    const isCurrentMonth = monthIdx === today.getMonth() && monthYear === today.getFullYear();
    if (isCurrentMonth) return;
    if (monthIdx === 11) { setMonthYear(y => y + 1); setMonthIdx(0); } else setMonthIdx(m => m + 1);
  };
  const prevYear = () => setAnnualYear(y => y - 1);
  const nextYear = () => { if (annualYear < today.getFullYear()) setAnnualYear(y => y + 1); };

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const prevCalMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const nextCalMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };

  const handlePrint = () => {
    const active = sales.filter((s) => s.status !== 'voided');
    const revenue      = active.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const profit       = active.reduce((sum, s) => (Number(s.unitPrice) - Number(s.product?.buyingPrice ?? 0)) * Number(s.quantity) + sum, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netProfit    = profit - totalExpenses;
    const cashSales    = active.filter((s) => s.paymentType === 'cash').reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const creditSales  = active.filter((s) => s.paymentType === 'credit').reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const mobileSales  = active.filter((s) => s.paymentType === 'mobile_money').reduce((sum, s) => sum + Number(s.totalAmount), 0);

    // Top products
    const prodMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    active.forEach((s) => {
      const name = s.product?.name ?? 'Unknown';
      if (!prodMap[name]) prodMap[name] = { name, qty: 0, revenue: 0 };
      prodMap[name].qty += Number(s.quantity);
      prodMap[name].revenue += Number(s.totalAmount);
    });
    const topProds = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue);

    // Top customers
    const custMap: Record<string, { name: string; total: number; count: number }> = {};
    active.filter((s) => s.customerName).forEach((s) => {
      const name = s.customerName!;
      if (!custMap[name]) custMap[name] = { name, total: 0, count: 0 };
      custMap[name].total += Number(s.totalAmount);
      custMap[name].count += 1;
    });
    const topCusts = Object.values(custMap).sort((a, b) => b.total - a.total);

    // Expense category breakdown
    const expCatMap: Record<string, number> = {};
    expenses.forEach((e) => { expCatMap[e.category] = (expCatMap[e.category] ?? 0) + Number(e.amount); });
    const expCats = Object.entries(expCatMap).sort((a, b) => b[1] - a[1]);

    // All sales rows — sorted newest first
    const salesRows = [...active]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((s) => `
        <tr>
          <td>${new Date(s.createdAt).toLocaleString()}</td>
          <td>${s.product?.name ?? '—'}</td>
          <td class="right">${s.quantity}</td>
          <td class="right">${fmt(s.unitPrice)}</td>
          <td class="right">${fmt(s.totalAmount)}</td>
          <td>${s.customerName ?? 'Walk-in'}</td>
          <td style="text-transform:capitalize">${s.paymentType.replace('_', ' ')}</td>
        </tr>`).join('');

    // All expenses rows — sorted newest first
    const expRows = [...expenses]
      .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
      .map((e) => `
        <tr>
          <td>${new Date(e.expenseDate).toLocaleDateString()}</td>
          <td style="text-transform:capitalize">${e.category.replace(/_/g, ' ')}</td>
          <td>${e.description ?? '—'}</td>
          <td class="right red">${fmt(e.amount)}</td>
        </tr>`).join('');

    const html = `
      <h1>Ovano Energies — ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Report</h1>
      <p class="meta">Period: ${periodLabel} &nbsp;·&nbsp; Generated: ${new Date().toLocaleString()}</p>

      <div class="summary">
        <div class="card"><div class="label">Revenue</div><div class="value">${fmt(revenue)}</div></div>
        <div class="card"><div class="label">Gross Profit</div><div class="value green">${fmt(profit)}</div></div>
        <div class="card"><div class="label">Expenses</div><div class="value red">${fmt(totalExpenses)}</div></div>
        <div class="card"><div class="label">Net Profit</div><div class="value ${netProfit >= 0 ? 'green' : 'red'}">${fmt(netProfit)}</div></div>
      </div>

      <h2>Payment Breakdown</h2>
      <table>
        <tr><th>Type</th><th class="right">Amount</th><th class="right">Transactions</th></tr>
        <tr><td>Cash</td><td class="right">${fmt(cashSales)}</td><td class="right">${active.filter(s=>s.paymentType==='cash').length}</td></tr>
        <tr><td>Credit</td><td class="right">${fmt(creditSales)}</td><td class="right">${active.filter(s=>s.paymentType==='credit').length}</td></tr>
        <tr><td>Mobile Money</td><td class="right">${fmt(mobileSales)}</td><td class="right">${active.filter(s=>s.paymentType==='mobile_money').length}</td></tr>
        <tr><td><strong>Total</strong></td><td class="right"><strong>${fmt(revenue)}</strong></td><td class="right"><strong>${active.length}</strong></td></tr>
      </table>

      ${topProds.length ? `
      <h2>Products Sold</h2>
      <table>
        <tr><th>#</th><th>Product</th><th class="right">Units Sold</th><th class="right">Revenue</th></tr>
        ${topProds.map((p, i) => `<tr><td>${i+1}</td><td>${p.name}</td><td class="right">${p.qty}</td><td class="right">${fmt(p.revenue)}</td></tr>`).join('')}
      </table>` : ''}

      ${topCusts.length ? `
      <h2>Customers</h2>
      <table>
        <tr><th>#</th><th>Customer</th><th class="right">Orders</th><th class="right">Total Spent</th></tr>
        ${topCusts.map((c, i) => `<tr><td>${i+1}</td><td>${c.name}</td><td class="right">${c.count}</td><td class="right">${fmt(c.total)}</td></tr>`).join('')}
      </table>` : ''}

      ${active.length ? `
      <h2>All Sales (${active.length})</h2>
      <table>
        <tr><th>Date & Time</th><th>Product</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th><th>Customer</th><th>Payment</th></tr>
        ${salesRows}
        <tr><td colspan="4"><strong>Total Revenue</strong></td><td class="right"><strong>${fmt(revenue)}</strong></td><td colspan="2"></td></tr>
      </table>` : ''}

      ${expCats.length ? `
      <h2>Expenses by Category</h2>
      <table>
        <tr><th>Category</th><th class="right">Amount</th></tr>
        ${expCats.map(([cat, total]) => `<tr><td style="text-transform:capitalize">${cat.replace(/_/g,' ')}</td><td class="right red">${fmt(total)}</td></tr>`).join('')}
        <tr><td><strong>Total</strong></td><td class="right red"><strong>${fmt(totalExpenses)}</strong></td></tr>
      </table>` : ''}

      ${expenses.length ? `
      <h2>All Expenses (${expenses.length})</h2>
      <table>
        <tr><th>Date</th><th>Category</th><th>Description</th><th class="right">Amount</th></tr>
        ${expRows}
        <tr><td colspan="3"><strong>Total Expenses</strong></td><td class="right red"><strong>${fmt(totalExpenses)}</strong></td></tr>
      </table>` : ''}

      <p class="footer">Ovano Energies Management &nbsp;·&nbsp; ${new Date().getFullYear()}</p>
    `;

    printHtml(html, `Ovano Energies ${viewMode} report — ${periodLabel}`);
  };

  return (
    <PageShell title="Reports" description="Daily, weekly, monthly and annual performance at a glance.">

      {/* ── View mode tabs ─────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 w-fit shadow-sm">
        {VIEW_MODES.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setViewMode(key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${viewMode === key ? 'bg-brand-500 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Daily: calendar strip ──────────────────────────────────────────── */}
      {viewMode === 'daily' && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevCalMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-lg">‹</button>
            <span className="text-sm font-semibold text-slate-800">{MONTHS[calMonth]} {calYear}</span>
            <button type="button" onClick={nextCalMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-lg">›</button>
          </div>
          <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const date = new Date(calYear, calMonth, day);
              const isToday = isSameDay(date, today);
              const isSelected = isSameDay(date, selectedDate);
              const isFuture = date > today;
              return (
                <button key={day} type="button" data-today={isToday ? 'true' : undefined}
                  disabled={isFuture} onClick={() => setSelectedDate(date)}
                  className={`flex shrink-0 flex-col items-center rounded-xl px-3 py-2 transition
                    ${isSelected ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30' :
                      isToday ? 'border-2 border-brand-400 bg-brand-50 text-brand-700' :
                      isFuture ? 'opacity-30 cursor-not-allowed bg-slate-50 text-slate-400' :
                      'bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-700'}`}>
                  <span className="text-[10px] font-medium uppercase tracking-wide">{WEEKDAY[date.getDay()]}</span>
                  <span className="mt-0.5 text-base font-bold">{day}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Weekly: prev/next week nav ─────────────────────────────────────── */}
      {viewMode === 'weekly' && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm w-fit">
          <button type="button" onClick={prevWeek} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-lg">‹</button>
          <span className="text-sm font-semibold text-slate-800 min-w-[220px] text-center">{periodLabel}</span>
          <button type="button" onClick={nextWeek} disabled={getWeekRange(weekAnchor).end >= today}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-lg disabled:opacity-30">›</button>
        </div>
      )}

      {/* ── Monthly: month picker ──────────────────────────────────────────── */}
      {viewMode === 'monthly' && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm w-fit">
          <button type="button" onClick={prevMonthNav} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-lg">‹</button>
          <span className="text-sm font-semibold text-slate-800 min-w-[160px] text-center">{MONTHS_FULL[monthIdx]} {monthYear}</span>
          <button type="button" onClick={nextMonthNav}
            disabled={monthIdx === today.getMonth() && monthYear === today.getFullYear()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-lg disabled:opacity-30">›</button>
        </div>
      )}

      {/* ── Annual: year picker ────────────────────────────────────────────── */}
      {viewMode === 'annually' && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm w-fit">
          <button type="button" onClick={prevYear} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-lg">‹</button>
          <span className="text-sm font-semibold text-slate-800 min-w-[80px] text-center">{annualYear}</span>
          <button type="button" onClick={nextYear} disabled={annualYear >= today.getFullYear()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-lg disabled:opacity-30">›</button>
        </div>
      )}

      {/* ── Period label + print ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Showing report for</p>
          <p className="text-lg font-bold text-slate-900">{periodLabel}</p>
        </div>
        {!loading && !error && (
          <button type="button" onClick={handlePrint}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            Print / Download PDF
          </button>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">Loading report…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <StatsPanel sales={sales} expenses={expenses} />
      )}
    </PageShell>
  );
}
