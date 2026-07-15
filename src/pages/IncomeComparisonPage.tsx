import { useCallback } from 'react';
import PageShell from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { API_URL, authHeader } from '../lib/api';
import { printHtml } from '../lib/print';

const fmt = (n: number) => `UGX ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const pct = (a: number, b: number) => b === 0 ? null : ((a - b) / Math.abs(b)) * 100;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface YearData {
  year: number; isPartial: boolean;
  revenue: number; grossProfit: number; totalExpenses: number;
  netProfit: number; taxProvision: number; netProfitAfterTax: number;
  monthly: { month: number; revenue: number; grossProfit: number; expenses: number; netProfit: number }[];
}

interface Comparison { current: YearData; previous: YearData }

export default function IncomeComparisonPage() {
  const { user } = useAuth();

  const fetchComp = useCallback(
    () => fetch(`${API_URL}/dashboard/income-comparison`, { headers: authHeader() })
      .then(r => { if (!r.ok) throw new Error('Failed to load comparison'); return r.json() as Promise<Comparison>; }),
    [user?.id],
  );

  const { data, loading, error, reload } = useFetch<Comparison>(fetchComp, [user?.id]);

  const handlePrint = () => {
    if (!data) return;
    const { current: c, previous: p } = data;

    const delta = (cv: number, pv: number) => {
      const d = pct(cv, pv);
      if (d === null) return '—';
      return `<span class="${d >= 0 ? 'green' : 'red'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}%</span>`;
    };

    const monthRows = MONTHS.map((m, i) => {
      const cm = c.monthly[i]; const pm = p.monthly[i];
      return `<tr>
        <td>${m}</td>
        <td class="right">${fmt(pm.revenue)}</td><td class="right">${fmt(cm.revenue)}</td><td class="right">${delta(cm.revenue, pm.revenue)}</td>
        <td class="right">${fmt(pm.netProfit)}</td><td class="right">${fmt(cm.netProfit)}</td><td class="right">${delta(cm.netProfit, pm.netProfit)}</td>
      </tr>`;
    }).join('');

    printHtml(`
      <h1>Income Comparison — Ovano Energies</h1>
      <p class="meta">${p.year} vs ${c.year}${c.isPartial ? ' (partial year)' : ''} &nbsp;·&nbsp; Generated: ${new Date().toLocaleString()}</p>

      <h2>Year Summary</h2>
      <table>
        <tr><th>Metric</th><th class="right">${p.year}</th><th class="right">${c.year}</th><th class="right">Change</th></tr>
        <tr><td>Revenue</td><td class="right">${fmt(p.revenue)}</td><td class="right">${fmt(c.revenue)}</td><td class="right">${delta(c.revenue, p.revenue)}</td></tr>
        <tr><td>Gross Profit</td><td class="right">${fmt(p.grossProfit)}</td><td class="right">${fmt(c.grossProfit)}</td><td class="right">${delta(c.grossProfit, p.grossProfit)}</td></tr>
        <tr><td>Total Expenses</td><td class="right red">${fmt(p.totalExpenses)}</td><td class="right red">${fmt(c.totalExpenses)}</td><td class="right">${delta(c.totalExpenses, p.totalExpenses)}</td></tr>
        <tr><td>Net Profit</td><td class="right ${p.netProfit >= 0 ? 'green' : 'red'}">${fmt(p.netProfit)}</td><td class="right ${c.netProfit >= 0 ? 'green' : 'red'}">${fmt(c.netProfit)}</td><td class="right">${delta(c.netProfit, p.netProfit)}</td></tr>
        <tr><td>Tax Provision (30%)</td><td class="right red">${fmt(p.taxProvision)}</td><td class="right red">${fmt(c.taxProvision)}</td><td class="right">${delta(c.taxProvision, p.taxProvision)}</td></tr>
        <tr><td><strong>Net Profit After Tax</strong></td><td class="right ${p.netProfitAfterTax >= 0 ? 'green' : 'red'}">${fmt(p.netProfitAfterTax)}</td><td class="right ${c.netProfitAfterTax >= 0 ? 'green' : 'red'}">${fmt(c.netProfitAfterTax)}</td><td class="right">${delta(c.netProfitAfterTax, p.netProfitAfterTax)}</td></tr>
      </table>

      <h2>Monthly Breakdown</h2>
      <table>
        <tr>
          <th>Month</th>
          <th class="right">Revenue ${p.year}</th><th class="right">Revenue ${c.year}</th><th class="right">Δ</th>
          <th class="right">Net ${p.year}</th><th class="right">Net ${c.year}</th><th class="right">Δ</th>
        </tr>
        ${monthRows}
      </table>

      <p class="footer">Ovano Energies Management &nbsp;·&nbsp; ${new Date().getFullYear()}</p>
    `, `Income Comparison ${p.year} vs ${c.year}`);
  };

  const Delta = ({ current, previous }: { current: number; previous: number }) => {
    const d = pct(current, previous);
    if (d === null) return <span className="text-xs text-slate-400">—</span>;
    return (
      <span className={`text-xs font-semibold ${d >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
      </span>
    );
  };

  const SummaryRow = ({ label, curr, prev }: { label: string; curr: number; prev: number }) => (
    <div className="grid grid-cols-4 gap-2 items-center py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="col-span-1 text-slate-600">{label}</span>
      <span className="text-right font-medium text-slate-500">{fmt(prev)}</span>
      <span className="text-right font-semibold text-slate-900">{fmt(curr)}</span>
      <span className="text-right"><Delta current={curr} previous={prev} /></span>
    </div>
  );

  return (
    <PageShell title="Income Comparison" description="Side-by-side revenue and profit comparison across years.">
      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">Loading comparison data…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => reload()} className="text-xs underline">Retry</button>
        </div>
      ) : data ? (
        <div className="space-y-6">

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {data.previous.year} vs {data.current.year}{data.current.isPartial ? ' (partial year to date)' : ''}
            </p>
            <button type="button" onClick={handlePrint}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              Print / Download PDF
            </button>
          </div>

          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Revenue', curr: data.current.revenue, prev: data.previous.revenue },
              { label: 'Gross Profit', curr: data.current.grossProfit, prev: data.previous.grossProfit },
              { label: 'Net Profit (after tax)', curr: data.current.netProfitAfterTax, prev: data.previous.netProfitAfterTax },
            ].map(({ label, curr, prev }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">{label}</p>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-400">{data.previous.year}</p>
                    <p className="text-base font-semibold text-slate-500">{fmt(prev)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{data.current.year}</p>
                    <p className={`text-xl font-bold ${curr >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{fmt(curr)}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <Delta current={curr} previous={prev} />
                </div>
              </div>
            ))}
          </div>

          {/* Year summary table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="grid grid-cols-4 gap-2 text-xs text-slate-400 uppercase tracking-wide mb-2 pb-2 border-b border-slate-100">
              <span>Metric</span>
              <span className="text-right">{data.previous.year}</span>
              <span className="text-right">{data.current.year}</span>
              <span className="text-right">Change</span>
            </div>
            <SummaryRow label="Revenue"            curr={data.current.revenue}            prev={data.previous.revenue} />
            <SummaryRow label="Gross Profit"       curr={data.current.grossProfit}        prev={data.previous.grossProfit} />
            <SummaryRow label="Total Expenses"     curr={data.current.totalExpenses}      prev={data.previous.totalExpenses} />
            <SummaryRow label="Net Profit"         curr={data.current.netProfit}          prev={data.previous.netProfit} />
            <SummaryRow label="Tax Provision"      curr={data.current.taxProvision}       prev={data.previous.taxProvision} />
            <SummaryRow label="Net Profit After Tax" curr={data.current.netProfitAfterTax} prev={data.previous.netProfitAfterTax} />
          </div>

          {/* Monthly chart table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 overflow-x-auto">
            <h2 className="text-base font-bold text-slate-900 mb-4">Monthly Breakdown</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="text-left pb-2">Month</th>
                  <th className="text-right pb-2">Rev {data.previous.year}</th>
                  <th className="text-right pb-2">Rev {data.current.year}</th>
                  <th className="text-right pb-2">Δ</th>
                  <th className="text-right pb-2">Net {data.previous.year}</th>
                  <th className="text-right pb-2">Net {data.current.year}</th>
                  <th className="text-right pb-2">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {MONTHS.map((m, i) => {
                  const cm = data.current.monthly[i];
                  const pm = data.previous.monthly[i];
                  return (
                    <tr key={m} className="hover:bg-slate-50">
                      <td className="py-1.5 font-medium text-slate-700">{m}</td>
                      <td className="py-1.5 text-right text-slate-400">{fmt(pm.revenue)}</td>
                      <td className="py-1.5 text-right font-semibold text-slate-800">{fmt(cm.revenue)}</td>
                      <td className="py-1.5 text-right"><Delta current={cm.revenue} previous={pm.revenue} /></td>
                      <td className={`py-1.5 text-right ${pm.netProfit >= 0 ? 'text-slate-400' : 'text-red-400'}`}>{fmt(pm.netProfit)}</td>
                      <td className={`py-1.5 text-right font-semibold ${cm.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(cm.netProfit)}</td>
                      <td className="py-1.5 text-right"><Delta current={cm.netProfit} previous={pm.netProfit} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      ) : null}
    </PageShell>
  );
}
