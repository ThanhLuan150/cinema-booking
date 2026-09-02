import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { DateInput } from '@/components/ui/DateInput';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useFinancialReport } from '../hooks/useFinancialReport';
import type { FinancialReport as FinancialReportData } from '../types/reporting.types';

const ACCENT = '#C1121F';
const POSITIVE = '#2E9E6B';
const NEGATIVE = '#C1121F';
const AXIS = '#A9B4C0';
const TOOLTIP_STYLE = {
  background: '#17293C',
  border: '1px solid rgba(245,245,220,0.16)',
  borderRadius: 8,
  color: '#F5F5DC',
};

const fmt = (value: number) => `${Math.round(value).toLocaleString()}đ`;
const tooltipFmt = (value: unknown) => fmt(Number(value) || 0);

const EMPTY_REPORT: FinancialReportData = {
  scope: 'ALL',
  branchIds: null,
  range: { from: null, to: null },
  totals: {
    branchCount: 0,
    employeeCount: 0,
    movieCount: 0,
    showtimeCount: 0,
    bookingCount: 0,
    ticketCount: 0,
  },
  revenue: { ticketRevenue: 0, comboRevenue: 0, discount: 0, refund: 0, netRevenue: 0 },
  revenueByBranch: [],
  topMovies: [],
  refundSummary: {
    count: 0,
    amount: 0,
    byStatus: {
      REQUESTED: { count: 0, amount: 0 },
      APPROVED: { count: 0, amount: 0 },
      REJECTED: { count: 0, amount: 0 },
      PROCESSING: { count: 0, amount: 0 },
      COMPLETED: { count: 0, amount: 0 },
      FAILED: { count: 0, amount: 0 },
    },
  },
  revenueByDay: [],
};

export interface FinancialReportProps {
  variant: 'system' | 'branch';
  branchId?: string;
}

interface StatTile {
  label: string;
  value: string;
  accent?: boolean;
}

export function FinancialReport({ variant, branchId }: FinancialReportProps) {
  const { t } = useTranslation('reporting');
  const [range, setRange] = useState({ from: '', to: '' });
  const { data, isLoading, isFetching, isError, error, refetch } = useFinancialReport({
    branchId,
    from: range.from || undefined,
    to: range.to || undefined,
  });

  const report = data ?? EMPTY_REPORT;
  const hasData = Boolean(data);
  const forbidden = isError && isAxiosError(error) && error.response?.status === 403;
  // First visit, nothing cached yet: show a plain loading screen, then swap to the report
  // once it arrives. A background refresh (date-range change) keeps the data on screen and
  // only shows the small "updating" chip below.
  const firstLoad = isLoading && !hasData;

  const tiles = useMemo<StatTile[]>(() => {
    const { totals, revenue } = report;
    const cell = (n: number | null) => (hasData && n != null ? String(n) : '—');
    const list: StatTile[] = [
      { label: t('stats.netRevenue'), value: hasData ? fmt(revenue.netRevenue) : '—', accent: true },
    ];
    if (variant === 'system') {
      list.push({ label: t('stats.branches'), value: cell(totals.branchCount) });
    }
    list.push(
      { label: t('stats.employees'), value: cell(totals.employeeCount) },
      { label: t('stats.showtimes'), value: cell(totals.showtimeCount) },
      { label: t('stats.bookings'), value: cell(totals.bookingCount) },
      { label: t('stats.tickets'), value: cell(totals.ticketCount) },
    );
    if (variant === 'system') {
      list.push({ label: t('stats.movies'), value: cell(totals.movieCount) });
    }
    return list;
  }, [report, hasData, variant, t]);

  const { revenue, revenueByBranch, topMovies, refundSummary, revenueByDay } = report;
  const showByBranch = variant === 'system' || revenueByBranch.length > 1;
  const refundsEmpty = Object.values(refundSummary.byStatus).every((b) => b.count === 0);

  const breakdownRows: { label: string; value: number; sign: 1 | -1 }[] = [
    { label: t('breakdown.ticketRevenue'), value: revenue.ticketRevenue, sign: 1 },
    { label: t('breakdown.comboRevenue'), value: revenue.comboRevenue, sign: 1 },
    { label: t('breakdown.discount'), value: revenue.discount, sign: -1 },
    { label: t('breakdown.refund'), value: revenue.refund, sign: -1 },
  ];

  if (firstLoad) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-txt/60">
        <Spinner size="lg" />
        <p>{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <DateInput
            id="report-range-from"
            label={t('range.from')}
            placeholder={t('range.from')}
            value={range.from}
            onChange={(e) =>
              setRange((r) => {
                const from = e.target.value;
                return { from, to: r.to && from && from > r.to ? '' : r.to };
              })
            }
          />
        </div>
        <div className="w-44">
          <DateInput
            id="report-range-to"
            label={t('range.to')}
            placeholder={t('range.to')}
            value={range.to}
            onChange={(e) =>
              setRange((r) => {
                const to = e.target.value;
                return { to, from: r.from && to && to < r.from ? '' : r.from };
              })
            }
          />
        </div>
        {(range.from || range.to) && (
          <Button type="button" variant="outline" onClick={() => setRange({ from: '', to: '' })}>
            {t('range.reset')}
          </Button>
        )}
        {isFetching && (
          <span className="mb-1 flex items-center gap-2 self-center rounded-full bg-white/5 px-3 py-1 text-xs text-txt/60">
            <Spinner size="sm" />
            {t('updating')}
          </span>
        )}
      </div>

      {isError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <i className="fa-solid fa-triangle-exclamation" />
          <span>{forbidden ? t('error.forbidden') : t('error.generic')}</span>
          <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => refetch()}>
            {t('error.retry')}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-sm text-txt/60">{tile.label}</p>
            <p className={`mt-1 text-xl font-bold ${tile.accent ? 'text-accent' : 'text-white'}`}>{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <h6 className="mb-3 font-semibold text-white">{t('breakdown.title')}</h6>
          <dl className="space-y-2 text-sm">
            {breakdownRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <dt className="text-txt/70">
                  <span className="mr-1 text-txt/40">{row.sign === -1 ? '−' : '+'}</span>
                  <span>{row.label}</span>
                </dt>
                <dd className={row.sign === -1 ? 'text-red-400' : 'text-txt'}>
                  {row.sign === -1 ? `−${fmt(row.value)}` : fmt(row.value)}
                </dd>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-border pt-2 font-semibold">
              <dt className="text-txt">{t('breakdown.netRevenue')}</dt>
              <dd className="text-accent">{fmt(revenue.netRevenue)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
          <h6 className="mb-3 font-semibold text-white">{t('refunds.title')}</h6>
          <div className="mb-3 flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white">{refundSummary.count}</span>
            <span className="text-sm text-txt/60">{t('refunds.completedCount')}</span>
            <span className="ml-auto text-lg font-semibold text-red-400">−{fmt(refundSummary.amount)}</span>
          </div>
          {refundsEmpty ? (
            <p className="text-sm text-txt/50">{t('noData')}</p>
          ) : (
            <dl className="space-y-1 text-sm">
              {Object.entries(refundSummary.byStatus)
                .filter(([, bucket]) => bucket.count > 0)
                .map(([status, bucket]) => (
                  <div key={status} className="flex items-center justify-between gap-4">
                    <dt className="text-txt/60">{t(`refunds.status.${status}`, { defaultValue: status })}</dt>
                    <dd className="text-txt/80">
                      {bucket.count} · {fmt(bucket.amount)}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
        </div>
      </div>

      {showByBranch && (
        <div className="h-[320px] rounded-xl border border-border bg-surface p-4 shadow-card">
          <h6 className="mb-4 font-semibold text-white">{t('byBranch.title')}</h6>
          {revenueByBranch.length === 0 ? (
            <EmptyState title={t('noData')} />
          ) : (
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={revenueByBranch}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis dataKey="branchName" stroke={AXIS} fontSize={12} />
                <YAxis stroke={AXIS} fontSize={12} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFmt} />
                <Bar dataKey="netRevenue" fill={ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <h6 className="mb-3 font-semibold text-white">{t('topMovies.title')}</h6>
        {topMovies.length === 0 ? (
          <EmptyState title={t('noData')} />
        ) : (
          <DataTable
            headers={[t('topMovies.movie'), t('topMovies.ticketsSold'), t('topMovies.revenue')]}
          >
            {topMovies.map((movie) => (
              <tr key={movie.movieId}>
                <td>{movie.name}</td>
                <td>{movie.ticketsSold.toLocaleString()}</td>
                <td>{fmt(movie.revenue)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <div className="h-[320px] rounded-xl border border-border bg-surface p-4 shadow-card">
        <h6 className="mb-4 font-semibold text-white">{t('byDay.title')}</h6>
        {revenueByDay.length === 0 ? (
          <EmptyState title={t('noData')} />
        ) : (
          <ResponsiveContainer width="100%" height="88%">
            <BarChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="date" stroke={AXIS} fontSize={12} />
              <YAxis stroke={AXIS} fontSize={12} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFmt} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {revenueByDay.map((row) => (
                  <Cell key={row.date} fill={row.total < 0 ? NEGATIVE : POSITIVE} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
