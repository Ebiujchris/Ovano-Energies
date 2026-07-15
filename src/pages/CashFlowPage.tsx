import { useCallback, useState } from 'react';
import PageShell from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { API_URL, authHeader } from '../lib/api';
import { printHtml } from '../lib/print';

const fmt = (n: number) => `UGX ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const currentYear = new Date().getFullYear();

interface AssetLine { name: string; cost: number; date: string }
interface CashFlow {
  year: number;
  operating: { cashInFromSales: number; operatingExpenses: number; stockPurchases: number; net: number };
  investing: { assetsAcquired: AssetLine[]; net: number };
  financing: { net: number };
  netCashFlow: number;
}

export default function CashFlowPage() {
  const { user } = useAuth();
  const [year, setYear] = useState(currentYear);

  const fetchCF = useCallback(
    () => fetch(`${API_URL}/dashboard/cash-flow?year=${year}`, { headers: authHeader() })
      .then(r => { if (!r.ok) throw new Error('Failed to load cash flow'); return r.json() as Promise<CashFlow>; }),
    [user?.id, year],
  );

  const { data: cf, loading, error, reload } = useFetch<CashFlow>(fetchCF, [user?.id, year]);

  const handlePrint = () => {
    if (!cf) return;
    const { operating: op, investing: inv, financing: fin } = cf;
    const assetRows = inv.assetsAcquired
      .map(a => `<tr><td>${a.name}</td><td>${new Date(a.date).toLocaleDateString()}</td><td class="right red">(${fmt(a.cost)})</td></tr>`)
      .join('');

    printHtml(`
      <h1>Cash Flow Statement — Ovano Energies</h1>
      <p class="meta">Year: ${cf.year} &nbsp;·&nbsp; Generated: ${new Date().toLocaleString()}</p>

      <h2>Operating Activities</h2>
      <table>
        <tr><td>Cash in from sales (cash + mobile)</td><td class="right green">${fmt(op.cashInFromSales)}</td></tr>
        <tr><td>Operating expenses paid</td><td class="right red">(${fmt(op.operatingExpenses)})</td></tr>
        <tr><td>Stock purchases</td><td class="right red">(${fmt(op.stockPurchases)})</td></tr>
        <tr><td><strong>Net cash from operations</strong></td><td class="right ${op.net >= 0 ? 'green' : 'red'}"><strong>${op.net >= 0 ? fmt(op.net) : `(${fmt(Math.abs(op.net))})`}</strong></td></tr>
      </table>

      <h2>Investing Activities</h2>
      <table>
        ${assetRows || '<tr><td colspan="3">No fixed asset purchases</td></tr>'}
        <tr><td><strong>Net cash from investing</strong></td><td></td><td class="right ${inv.net >= 0 ? 'green' : 'red'}"><strong>${inv.net >= 0 ? fmt(inv.net) : `(${fmt(Math.abs(inv.net))})`}</strong></td></tr>
      </table>

      <h2>Financing Activities</h2>
      <table>
        <tr><td>Capital contributions / withdrawals</td><td class="right">${fmt(fin.net)}</td></tr>
        <tr><td><strong>Net cash from financing</strong></td><td class="right"><strong>${fmt(fin.net)}</strong></td></tr>
      </table>

      <h2>Net Cash Flow</h2>
      <table>
        <tr><td><strong>Net change in cash</strong></td><td class="right ${cf.netCashFlow >= 0 ? 'green' : 'red'}"><strong>${cf.netCashFlow >= 0 ? fmt(cf.netCashFlow) : `(${fmt(Math.abs(cf.netCashFlow))})`}</strong></td></tr>
      </table>

      <p class="footer">Ovano Energies Management &nbsp;·&nbsp; ${new Date().getFullYear()}</p>
    `, `Cash Flow Statement ${cf.year}`);
  };

  const Section = ({ title, net, color, children }: { title: string; net: number; color: string; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <span className={`text-base font-bold ${color}`}>{net >= 0 ? fmt(net) : `(${fmt(Math.abs(net))})`}</span>
      </div>
      {children}
    </div>
  );

  const Row = ({ label, value, sub }: { label: string; value: number; sub?: string }) => (
    <div className="flex items-center justify-between text-sm">
      <div>
        <p className="text-slate-700">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <span className={`font-semibold ${value >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
        {value >= 0 ? fmt(value) : `(${fmt(Math.abs(value))})`}
      </span>
    </div>
  );

  return (
    <PageShell title="Cash Flow Statement" description="Track how cash moves through your shop — operations, investments, and financing.">
      {/* Year selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          {[currentYear - 1, currentYear].map(y => (
            <button key={y} type="button" onClick={() => setYear(y)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${y === year ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              {y}
            </button>
          ))}
        </div>
        <button type="button" onClick={handlePrint} disabled={!cf}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50">
          Print / Download PDF
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">Loading cash flow data…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => reload()} className="text-xs underline">Retry</button>
        </div>
      ) : cf ? (
        <div className="space-y-6">

          {/* Net cash flow banner */}
          <div className={`rounded-2xl border p-5 text-center ${cf.netCashFlow >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-1">Net Cash Flow {cf.year}</p>
            <p className={`text-4xl font-bold ${cf.netCashFlow >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {cf.netCashFlow >= 0 ? fmt(cf.netCashFlow) : `(${fmt(Math.abs(cf.netCashFlow))})`}
            </p>
            <p className="text-xs text-slate-500 mt-1">{cf.netCashFlow >= 0 ? 'Positive cash position' : 'Cash outflow exceeds inflow'}</p>
          </div>

          {/* Operating */}
          <Section title="Operating Activities" net={cf.operating.net} color={cf.operating.net >= 0 ? 'text-emerald-700' : 'text-red-600'}>
            <Row label="Cash in from sales" sub="Cash & mobile money only" value={cf.operating.cashInFromSales} />
            <Row label="Operating expenses paid" value={-cf.operating.operatingExpenses} />
            <Row label="Stock purchases (cash)" value={-cf.operating.stockPurchases} />
          </Section>

          {/* Investing */}
          <Section title="Investing Activities" net={cf.investing.net} color={cf.investing.net >= 0 ? 'text-emerald-700' : 'text-red-600'}>
            {cf.investing.assetsAcquired.length === 0 ? (
              <p className="text-sm text-slate-400">No fixed asset purchases this year</p>
            ) : (
              cf.investing.assetsAcquired.map(a => (
                <Row key={a.name + a.date} label={a.name} sub={new Date(a.date).toLocaleDateString('en-UG')} value={-a.cost} />
              ))
            )}
          </Section>

          {/* Financing */}
          <Section title="Financing Activities" net={cf.financing.net} color="text-slate-700">
            <p className="text-sm text-slate-400">Capital contributions and owner withdrawals tracked here.</p>
            <Row label="Net financing" value={cf.financing.net} />
          </Section>

        </div>
      ) : null}
    </PageShell>
  );
}
