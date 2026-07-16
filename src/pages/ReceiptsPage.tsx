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
  const sorted = [...sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const groups: ReceiptGroup[] = [];
  for (const sale of sorted) {
    const saleTime = new Date(sale.createdAt).getTime();
    const customer = sale.customerName || 'Walk-in customer';
    const existing = groups.find(
      (g) => g.customer === customer && g.paymentType === sale.paymentType &&
        Math.abs(new Date(g.date).getTime() - saleTime) < 5 * 60 * 1000,
    );
    if (existing) {
      existing.items.push(sale);
      existing.total += Number(sale.totalAmount);
    } else {
      groups.push({ key: sale.id, customer, paymentType: sale.paymentType, date: sale.createdAt, items: [sale], total: Number(sale.totalAmount) });
    }
  }
  return groups;
}

function printReceipt(group: ReceiptGroup) {
  const receiptNo = group.key.slice(0, 8).toUpperCase();
  const dateStr = new Date(group.date).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' });

  const rows = group.items.map((item) => `
    <tr>
      <td>${item.product?.name ?? 'Product'}</td>
      <td class="center">${item.quantity}</td>
      <td class="right">${fmt(item.unitPrice)}</td>
      <td class="right bold">${fmt(item.totalAmount)}</td>
    </tr>`).join('');

  printHtml(`
    <div class="receipt-wrap">
      <!-- Header -->
      <div class="receipt-header">
        <div class="logo-box">OE</div>
        <div>
          <div class="company">Ovano Energies</div>
          <div class="tagline">Energy & Electronics Retail</div>
        </div>
      </div>

      <div class="divider-thick"></div>

      <!-- Receipt meta -->
      <div class="meta-row">
        <div>
          <div class="label">Receipt No.</div>
          <div class="value">#${receiptNo}</div>
        </div>
        <div style="text-align:right">
          <div class="label">Date & Time</div>
          <div class="value">${dateStr}</div>
        </div>
      </div>

      <!-- Customer & payment -->
      <div class="info-strip">
        <div class="info-item">
          <span class="label">Customer</span>
          <span class="value">${group.customer}</span>
        </div>
        <div class="info-item">
          <span class="label">Payment</span>
          <span class="value payment-badge ${group.paymentType}">${group.paymentType.replace('_', ' ')}</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Items -->
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="center">Qty</th>
            <th class="right">Unit Price</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="divider"></div>

      <!-- Total -->
      <div class="total-row">
        <span>Total Amount</span>
        <span class="total-amount">${fmt(group.total)}</span>
      </div>

      <!-- Footer -->
      <div class="receipt-footer">
        <div class="thank-you">Thank you for your business!</div>
        <div class="footer-note">Ovano Energies · Kampala, Uganda</div>
        <div class="footer-note">Keep this receipt for your records</div>
      </div>
    </div>
  `, `Receipt #${receiptNo}`, `
    .receipt-wrap { max-width: 480px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; }
    .receipt-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .logo-box { width: 48px; height: 48px; background: #2563eb; color: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; flex-shrink: 0; }
    .company { font-size: 20px; font-weight: 800; color: #0f172a; }
    .tagline { font-size: 11px; color: #64748b; margin-top: 2px; }
    .divider-thick { border: none; border-top: 3px solid #0f172a; margin: 0 0 18px; }
    .divider { border: none; border-top: 1px dashed #cbd5e1; margin: 16px 0; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 16px; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; margin-bottom: 3px; }
    .value { font-size: 13px; font-weight: 600; color: #0f172a; }
    .info-strip { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; display: flex; gap: 24px; margin-bottom: 4px; }
    .info-item { display: flex; flex-direction: column; gap: 3px; }
    .payment-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
    .cash { background: #dcfce7; color: #16a34a; }
    .credit { background: #fef9c3; color: #a16207; }
    .mobile_money { background: #dbeafe; color: #1d4ed8; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; padding: 7px 8px; border-bottom: 1px solid #e2e8f0; }
    td { padding: 9px 8px; font-size: 12px; color: #334155; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 600; }
    .total-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 8px; background: #1e40af; border-radius: 10px; color: #fff; }
    .total-row span:first-child { font-size: 13px; font-weight: 600; }
    .total-amount { font-size: 20px; font-weight: 800; }
    .receipt-footer { margin-top: 24px; text-align: center; }
    .thank-you { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .footer-note { font-size: 11px; color: #94a3b8; line-height: 1.6; }
  `);
}

const paymentColors: Record<string, string> = {
  cash:         'bg-emerald-100 text-emerald-700',
  credit:       'bg-amber-100 text-amber-700',
  mobile_money: 'bg-blue-100 text-blue-700',
};

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
    <PageShell title="Receipts" description="All transaction receipts. Click Print to get a copy.">
      <div className="space-y-5">

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
          />
          {dateFilter && (
            <button type="button" onClick={() => setDateFilter('')}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200">
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
            <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center text-slate-500">
              {sales.length === 0 ? 'No sales recorded yet.' : 'No receipts match your filters.'}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((group) => {
                const receiptNo = group.key.slice(0, 8).toUpperCase();
                const dateStr = new Date(group.date).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' });

                return (
                  <div key={group.key}
                    className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">

                    {/* Top color bar */}
                    <div className={`h-1.5 w-full ${group.paymentType === 'credit' ? 'bg-amber-400' : group.paymentType === 'mobile_money' ? 'bg-blue-500' : 'bg-emerald-500'}`} />

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-[10px] font-bold text-white shadow shadow-brand-600/30">
                            OE
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{group.customer}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{dateStr}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${paymentColors[group.paymentType] ?? 'bg-slate-100 text-slate-600'}`}>
                          {group.paymentType.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Receipt number */}
                      <div className="mb-3 flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Receipt</span>
                        <span className="text-[10px] font-mono font-semibold text-slate-600">#{receiptNo}</span>
                      </div>

                      {/* Items */}
                      <div className="rounded-xl bg-slate-50 p-3 space-y-1.5">
                        {group.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 truncate">{item.product?.name ?? 'Product'}</span>
                            <div className="shrink-0 flex items-center gap-2 ml-2">
                              <span className="text-[10px] text-slate-400">×{item.quantity}</span>
                              <span className="font-medium text-slate-800">{fmt(item.totalAmount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total + print */}
                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
                          <p className="text-lg font-bold text-slate-900">{fmt(group.total)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => printReceipt(group)}
                          className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow shadow-brand-500/20 hover:bg-brand-600 transition"
                        >
                          <span>🖨</span> Print
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </PageShell>
  );
}
