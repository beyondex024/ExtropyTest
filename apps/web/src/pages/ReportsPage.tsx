import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useByCategoryReport, useMonthlyReport } from "../api/queries.js";

function monthBoundsUtc(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const monthly = useMonthlyReport(year, month);

  const { start: defaultFrom, end: defaultTo } = useMemo(() => monthBoundsUtc(year, month), [year, month]);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  // Keep range in sync when user changes month/year via the monthly controls
  const syncRange = () => {
    const b = monthBoundsUtc(year, month);
    setFrom(b.start);
    setTo(b.end);
  };

  const byCategory = useByCategoryReport(from, to);

  const chartData = (byCategory.data?.breakdown ?? []).map((b) => ({
    name: b.name.length > 18 ? `${b.name.slice(0, 18)}…` : b.name,
    total: Number(b.total.toFixed(2))
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-slate-600">Monthly totals and category breakdowns for a selected window.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-base font-semibold">Total spending for a month</h2>
            <p className="mt-1 text-sm text-slate-600">Uses UTC month boundaries for consistency across time zones.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: "long" })}
                </option>
              ))}
            </select>
            <input
              className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
            <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={syncRange}>
              Sync range
            </button>
          </div>
        </div>

        <div className="mt-6">
          {monthly.isLoading ? (
            <div className="text-sm text-slate-600">Loading…</div>
          ) : monthly.isError ? (
            <div className="text-sm text-rose-700">{(monthly.error as Error).message}</div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-600">Total</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">
                {monthly.data?.currency ?? "USD"} {monthly.data?.total.toFixed(2) ?? "0.00"}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Range: {new Date(monthly.data?.range.from ?? "").toLocaleString()} →{" "}
                {new Date(monthly.data?.range.to ?? "").toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Spending by category</h2>
        <p className="mt-1 text-sm text-slate-600">Pick a date range, then review totals (bar chart or table).</p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">From (ISO)</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">To (ISO)</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button type="button" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={syncRange}>
              Reset to selected month
            </button>
          </div>
        </div>

        <div className="mt-6 h-72 w-full">
          {byCategory.isLoading ? (
            <div className="text-sm text-slate-600">Loading chart…</div>
          ) : byCategory.isError ? (
            <div className="text-sm text-rose-700">{(byCategory.error as Error).message}</div>
          ) : chartData.length === 0 ? (
            <div className="text-sm text-slate-600">No expenses in this range yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => v.toFixed(2)} />
                <Bar dataKey="total" fill="#0f172a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Category</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(byCategory.data?.breakdown ?? []).map((b) => (
                <tr key={b.categoryId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{b.name}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{b.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
