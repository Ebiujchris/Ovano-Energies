import { useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useFetch } from '../hooks/useFetch';
import { API_URL, authHeader, bustCache } from '../lib/api';

interface Credit {
  id: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  amountPaid: number;
  description?: string;
  status: 'pending' | 'partially_paid' | 'fully_paid';
  dueDate?: string;
  createdAt: string;
}

const fmt = (n: number) => `UGX ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const statusStyle: Record<string, string> = {
  pending:        'bg-red-100 text-red-600',
  partially_paid: 'bg-amber-100 text-amber-600',
  fully_paid:     'bg-emerald-100 text-emerald-700',
};

export default function CreditsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [filter, setFilter]     = useState<'all' | 'pending' | 'partially_paid' | 'fully_paid'>('all');
  const [search, setSearch]     = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Manual credit form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', totalAmount: '', description: '', dueDate: '' });

  const { data: credits = [], loading, error, reload } = useFetch<Credit[]>(
    () => fetch(`${API_URL}/credits`, { headers: authHeader() }).then((r) => {
      if (!r.ok) throw new Error('Failed to load credits');
      return r.json();
    }),
    [user?.id],
  );

  const filtered = useMemo(() => credits.filter((c) => {
    const matchFilter = filter === 'all' || c.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || c.customerName.toLowerCase().includes(q) || (c.customerPhone ?? '').includes(q);
    return matchFilter && matchSearch;
  }), [credits, filter, search]);

  const stats = useMemo(() => ({
    total:      credits.reduce((s, c) => s + Number(c.totalAmount), 0),
    paid:       credits.reduce((s, c) => s + Number(c.amountPaid), 0),
    outstanding:credits.filter(c => c.status !== 'fully_paid').reduce((s, c) => s + (Number(c.totalAmount) - Number(c.amountPaid)), 0),
    pending:    credits.filter(c => c.status === 'pending').length,
    partial:    credits.filter(c => c.status === 'partially_paid').length,
    overdue:    credits.filter(c => c.dueDate && new Date(c.dueDate) < new Date() && c.status !== 'fully_paid').length,
  }), [credits]);

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          customerName: form.customerName,
          customerPhone: form.customerPhone || undefined,
          totalAmount: Number(form.totalAmount),
          description: form.description || undefined,
          dueDate: form.dueDate || undefined,
          userId: user?.id,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'Failed');
      toast.success('Credit recorded');
      setForm({ customerName: '', customerPhone: '', totalAmount: '', description: '', dueDate: '' });
      setShowForm(false);
      bustCache('/credits'); reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handlePay = async (id: string) => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/credits/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ amount }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'Failed');
      toast.success('Payment recorded');
      setPayingId(null); setPayAmount('');
      bustCache('/credits'); reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this credit record?')) return;
    await fetch(`${API_URL}/credits/${id}`, { method: 'DELETE', headers: authHeader() });
    reload();
  };

  return (
    <PageShell title="Credits & Debts" description="Track who owes you money and record repayments.">

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-500 font-semibold uppercase tracking-wide">Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{fmt(stats.outstanding)}</p>
          <p className="text-xs text-red-400 mt-0.5">{stats.pending + stats.partial} open accounts</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Partial</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{stats.partial}</p>
          <p className="text-xs text-amber-500 mt-0.5">partially paid</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Total Collected</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{fmt(stats.paid)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${stats.overdue > 0 ? 'border-red-300 bg-red-100' : 'border-slate-200 bg-white'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overdue</p>
          <p className={`mt-1 text-2xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-slate-400'}`}>{stats.overdue}</p>
          <p className="text-xs text-slate-400 mt-0.5">past due date</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

        {/* Left: add credit form */}
        <div className="w-full lg:w-[360px] lg:shrink-0">
          {!showForm ? (
            <button type="button" onClick={() => setShowForm(true)}
              className="w-full rounded-2xl border-2 border-dashed border-brand-300 py-4 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition">
              + Add manual credit
            </button>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-slate-900">New credit record</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
              <form onSubmit={handleAddCredit} className="space-y-3">
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Customer name" required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Phone number (optional)" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Amount owed (UGX)" type="number" min="1" required value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Due date (optional)</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
                <button type="submit" disabled={submitting} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition hover:bg-brand-600">
                  {submitting ? 'Saving…' : 'Save credit'}
                </button>
              </form>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400 leading-relaxed">
            Credits from sales are auto-recorded. Use the form above for cash debts, loans given, or any amount owed outside of sales.
          </p>
        </div>

        {/* Right: credits list */}
        <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input className="w-52 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              placeholder="Search customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pending', 'partially_paid', 'fully_paid'] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition capitalize ${filter === f ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f === 'all' ? `All (${credits.length})` : f.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-slate-400">{filtered.length} records</span>
          </div>

          {loading ? <SkeletonList rows={5} />
            : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
                {credits.length === 0 ? 'No credit records yet.' : 'No records match your filters.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filtered.map((c) => {
                  const balance = Number(c.totalAmount) - Number(c.amountPaid);
                  const isOverdue = c.dueDate && new Date(c.dueDate) < new Date() && c.status !== 'fully_paid';
                  return (
                    <div key={c.id} className={`rounded-xl border p-4 ${isOverdue ? 'border-red-300 bg-red-50' : c.status === 'fully_paid' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900">{c.customerName}</p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyle[c.status]}`}>
                              {c.status.replace(/_/g, ' ')}
                            </span>
                            {isOverdue && <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>}
                          </div>
                          {c.customerPhone && <p className="text-xs text-slate-500 mt-0.5">{c.customerPhone}</p>}
                          {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(c.createdAt).toLocaleDateString()}
                            {c.dueDate && ` · Due ${new Date(c.dueDate).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-400">Total: {fmt(c.totalAmount)}</p>
                          <p className="text-xs text-emerald-600">Paid: {fmt(c.amountPaid)}</p>
                          <p className={`font-bold text-base ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(balance)} {balance > 0 ? 'owed' : '✓'}</p>
                        </div>
                      </div>

                      {/* Pay inline */}
                      {c.status !== 'fully_paid' && (
                        <div className="mt-3 border-t border-slate-200 pt-3">
                          {payingId === c.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number" min="1" placeholder="Amount paid"
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
                                value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                                autoFocus
                              />
                              <button type="button" onClick={() => handlePay(c.id)} disabled={submitting}
                                className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60">
                                {submitting ? '…' : 'Record'}
                              </button>
                              <button type="button" onClick={() => { setPayingId(null); setPayAmount(''); }}
                                className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <button type="button" onClick={() => { setPayingId(c.id); setPayAmount(''); }}
                                className="rounded-xl border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition">
                                Record payment
                              </button>
                              <button type="button" onClick={() => handleDelete(c.id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
                            </div>
                          )}
                        </div>
                      )}
                      {c.status === 'fully_paid' && (
                        <div className="mt-2 flex justify-end">
                          <button type="button" onClick={() => handleDelete(c.id)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </PageShell>
  );
}
