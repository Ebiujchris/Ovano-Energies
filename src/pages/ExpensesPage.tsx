import { useCallback, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useFetch } from '../hooks/useFetch';
import { API_URL, authHeader, bustCache } from '../lib/api';

interface Expense {
  id: string;
  category: string;
  amount: number;
  description?: string;
  supplier?: string;
  expenseDate: string;
}

const CATEGORIES = [
  'rent', 'electricity', 'water', 'internet', 'utilities',
  'transport', 'fuel', 'stock_purchase', 'stock_loss',
  'salaries', 'casual_labour', 'taxes', 'repairs',
  'advertising', 'miscellaneous',
];

const MONTHS_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const fmt = (n: number) => `UGX ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end   = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const toast    = useToast();
  const today    = useMemo(() => new Date(), []);

  // Month navigator — defaults to current month
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (isCurrentMonth) return; // can't go into the future
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('all');
  const [form, setForm] = useState({
    category: 'rent',
    amount: '',
    description: '',
    supplier: '',
    expenseDate: today.toISOString().split('T')[0],
  });

  // Fetch expenses for the selected month via by-date-range
  const { start, end } = useMemo(() => monthRange(viewYear, viewMonth), [viewYear, viewMonth]);

  const fetchExpenses = useCallback(
    () => fetch(
      `${API_URL}/expenses/by-date-range?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
      { headers: authHeader() },
    ).then((r) => {
      if (!r.ok) throw new Error('Failed to load expenses');
      return r.json() as Promise<Expense[]>;
    }),
    [start, end, user?.id],
  );

  const { data: expenses = [], loading, error, reload } = useFetch<Expense[]>(fetchExpenses, [start, end, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount) { toast.error('Enter an amount'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          category: form.category,
          amount: Number(form.amount),
          description: form.description || undefined,
          supplier: form.supplier || undefined,
          expenseDate: form.expenseDate,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(payload.message) ? payload.message[0] : payload.message || 'Failed');
      toast.success('Expense recorded');
      bustCache('/expenses');
      bustCache('/dashboard');
      setForm({ category: 'rent', amount: '', description: '', supplier: '', expenseDate: today.toISOString().split('T')[0] });
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await fetch(`${API_URL}/expenses/${id}`, { method: 'DELETE', headers: authHeader() });
      toast.success('Expense deleted');
      reload();
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = useMemo(() => expenses.filter((e) => {
    const matchCat = catFilter === 'all' || e.category === catFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (e.description ?? '').toLowerCase().includes(q) ||
      (e.supplier ?? '').toLowerCase().includes(q) ||
      e.category.includes(q);
    return matchCat && matchSearch;
  }), [expenses, catFilter, search]);

  const monthTotal    = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);

  // Category breakdown for the month
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] ?? 0) + Number(e.amount); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <PageShell title="Expenses" description="Each month starts fresh. All history is kept for auditing.">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">

        {/* ── Left: form + summary ────────────────────────────────────────── */}
        <div className="w-full lg:w-[400px] lg:shrink-0 space-y-4">

          {/* Record form */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Record expense</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                ))}
              </select>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Amount (UGX)" type="number" min="1"
                value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Description (optional)"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Supplier / paid to (optional)"
                value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                type="date" value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
              <button type="submit" disabled={submitting}
                className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition hover:bg-brand-600">
                {submitting ? 'Saving…' : 'Save expense'}
              </button>
            </form>
          </div>

          {/* Monthly total */}
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-400">
              {MONTHS_FULL[viewMonth]} {viewYear} total
            </p>
            <p className="mt-1 text-2xl font-bold text-red-600">{fmt(monthTotal)}</p>
            <p className="text-xs text-red-400 mt-0.5">{expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}</p>
          </div>

          {/* Category breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">This month by category</p>
              <div className="space-y-2">
                {categoryBreakdown.map(([cat, total]) => (
                  <div key={cat} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700 capitalize">{cat.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-semibold text-red-600">{fmt(total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: month navigator + list ──────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 w-full lg:max-w-xl">

          {/* Month navigator */}
          <div className="flex items-center justify-between mb-5">
            <button type="button" onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-lg">
              ‹
            </button>
            <div className="text-center">
              <p className="text-base font-bold text-slate-900">{MONTHS_FULL[viewMonth]} {viewYear}</p>
              {isCurrentMonth && (
                <span className="text-xs font-medium text-brand-600">Current month</span>
              )}
            </div>
            <button type="button" onClick={nextMonth} disabled={isCurrentMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-lg disabled:opacity-30">
              ›
            </button>
          </div>

          {/* Search + category filter */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between gap-2">
              <input
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                placeholder="Search description or supplier..."
                value={search} onChange={(e) => setSearch(e.target.value)} />
              {filtered.length !== expenses.length && (
                <span className="shrink-0 text-xs text-slate-400">{fmt(filteredTotal)}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setCatFilter('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${catFilter === 'all' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                All ({expenses.length})
              </button>
              {CATEGORIES.filter((c) => expenses.some((e) => e.category === c)).map((c) => (
                <button key={c} type="button" onClick={() => setCatFilter(c)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${catFilter === c ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {c.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? <SkeletonList rows={5} />
            : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center justify-between">
                <span>{error}</span>
                <button type="button" onClick={() => reload()} className="text-xs underline">Retry</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                {expenses.length === 0
                  ? `No expenses recorded for ${MONTHS_FULL[viewMonth]} ${viewYear}.`
                  : 'No expenses match filters.'}
              </div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
                {filtered.map((e) => (
                  <div key={e.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 capitalize">
                            {e.category.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {e.description && <p className="mt-0.5 text-sm text-slate-700">{e.description}</p>}
                        {e.supplier && <p className="text-xs text-slate-400">{e.supplier}</p>}
                        <p className="text-xs text-slate-400">{new Date(e.expenseDate).toLocaleDateString()}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-red-600">{fmt(e.amount)}</p>
                        <button type="button" onClick={() => handleDelete(e.id)}
                          className="mt-1 text-xs text-slate-400 hover:text-red-500 transition">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </PageShell>
  );
}
