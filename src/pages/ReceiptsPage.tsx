import { useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { SkeletonList } from '../components/Skeleton';
import { useFetch } from '../hooks/useFetch';
import { API_URL, authHeader } from '../lib/api';
import { printHtml } from '../lib/print';

interface SaleItem {
  id: string;
  product?: { name: string };
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentType: string;
  customerName?: string;
  status?: string;
  createdAt: string;
}

interface ReceiptGroup {
  key: string;
  customer: string;
  paymentType: string;
  date: string;
  items: SaleItem[];
  total: number;
}

const fmt = (n: number) => `UGX ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function groupIntoReceipts(sales: SaleItem[]): ReceiptGroup[] {
  // Group sales made within 5 minutes by the same customer
  const sorted = [...sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const groups: ReceiptGroup[] = [];

  for (const sale of sorted) {
    const saleTime = new Date(sale.createdAt).getTime();
    const customer = sale.customerName || 'Walk-in customer';
    const existing = groups.find(
      (g) =>
        g.customer === customer &&
        g.paymentType === sale.paymentType &&
        Math.abs(new Date(g.date).getTime() - saleTime) < 5 * 60 * 1000,
    );
    if (existing) {
      existing.items.push(sale);
      existing.total += Number(sale.totalAmount);
    } else {
      groups.push({
        key: sale.id,
        customer,
        paymentType: sale.paymentType,
        date: sale.createdAt,
        items: [sale],
        total: Number(sale.totalAmount),
      });
    }
  }
  return groups;
}

function printReceipt(group: ReceiptGroup) {
  const rows = group.items.map((item) =>
    `<tr>
      <td>${item.product?.name ?? 'Product'}</td>
      <td class="right">${item.quantity}</td>
      <td class="right">${fmt(item.unitPrice)}</td>
      <td class="right">${fmt(item.totalAmount)}</td>
    </tr>`,
  ).join('');

  printHtml(`
    <h1>Receipt</h1>
    <p class="meta">
      Invoice #${group.key.slice(0, 8).toUpperCase()} &nbsp;·&nbsp;
      ${new Date(group.date).toLocaleString()}
    </p>
    <hr class="divider" />
    <table>
      <tr><th>Item</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr>
      ${rows}
    </table>
    <hr class="divider" />
    <table>
      <tr><td>Customer</td><td class="right">${group.customer}</td></tr>
      <tr><td>Payment</td><td class="right" style="text-transform:capitalize">${group.paymentType.replace('_', ' ')}</td></tr>
      <tr><td><strong>Total</strong></td><td class="right"><strong>${fmt(group.total)}</strong></td></tr>
    </table>
    <p class="footer">Thank you for your business &nbsp;·&nbsp; Ovano Energies</p>
  `, `Receipt #${group.key.slice(0, 8).toUpperCase()}`);
}

export default function ReceiptsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const { data: sales = [], loading, error, reload } = useFetch<SaleItem[]>(
    () => fetch(`${API_URL}/sales`, { headers: authHeader() }).then((r) => {
      if (!r.ok) throw new Error('Failed to load receipts');
      return r.json();
    }),
    [user?.id],
  );

  const activeSales = useMemo(() => sales.filter((s) => s.status !== 'voided'), [sales]);
  const groups = useMemo(() => groupIntoReceipts(activeSales), [activeSales]);

  const filtered = useMemo(() => groups.filter((g) => {
    const matchPay = payFilter === 'all' || g.paymentType === payFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || g.customer.toLowerCase().includes(q) ||
      g.items.some((i) => (i.product?.name ?? '').toLowerCase().includes(q));
    const matchDate = !dateFilter || new Date(g.date).toISOString().split('T')[0] === dateFilter;
    return matchPay && matchSearch && matchDate;
  }), [groups, payFilter, search, dateFilter]);

  return (
    <PageShell title="Receipts" description="All transaction receipts. Click any to print or download.">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="w-64 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            placeholder="Search customer or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            type="date"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            title="Filter by date"
          />
          {dateFilter && (
            <button type="button" onClick={() => setDateFilter('')}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 transition">
              Clear date
            </button>
          )}
          <div className="flex gap-2">
            {(['all', 'cash', 'credit', 'mobile_money'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setPayFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${payFilter === f ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f === 'all' ? `All (${groups.length})` : f.replace('_', ' ')}
              </button>
            ))}
          </div>
          <span className="ml-auto text-sm text-slate-400">{filtered.length} receipts</span>
        </div>

        {loading ? <SkeletonList rows={6} />
          : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => reload()} className="text-xs underline">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
              {sales.length === 0 ? 'No sales recorded yet.' : 'No receipts match your filters.'}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((group) => (
                <div key={group.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{group.customer}</p>
                      <p className="text-xs text-slate-400">{new Date(group.date).toLocaleString()}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${group.paymentType === 'credit' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {group.paymentType.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 truncate">{item.product?.name ?? 'Product'} × {item.quantity}</span>
                        <span className="shrink-0 text-slate-600 ml-2">{fmt(item.totalAmount)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Total + print */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="font-semibold text-slate-900">{fmt(group.total)}</span>
                    <button
                      type="button"
                      onClick={() => printReceipt(group)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      Print / PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </PageShell>
  );
}
