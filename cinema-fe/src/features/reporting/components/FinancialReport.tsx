import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useFinancialReport } from '../hooks/useFinancialReport';

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
  const { data: report, isLoading } = useFinancialReport({
    branchId,
    from: range.from || undefined,
    to: range.to || undefined,
  });

  const tiles = useMemo<StatTile[]>(() => {
    if (!report) return [];
    const { totals, revenue } = report;
    const list: StatTile[] = [{ label: t('stats.netRevenue'), value: fmt(revenue.netRevenue), accent: true }];
    if (variant === 'system') {
      list.push({ label: t('stats.branches'), value: String(totals.branchCount) });
    }
    list.push(
      { label: t('stats.employees'), value: String(totals.employeeCount) },
      { label: t('stats.showtimes'), value: String(totals.showtimeCount) },
      { label: t('stats.bookings'), value: String(totals.bookingCount) },
      { label: t('stats.tickets'), value: String(totals.ticketCount) },
    );
    if (variant === 'system' && totals.movieCount != null) {
      list.push({ label: t('stats.movies'), value: String(totals.movieCount) });
    }
    return list;
  }, [report, variant, t]);

  const rangePicker = (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="max-w-[12rem]">
        <Input
          id="report-range-from"
          type="date"
          label={t('range.from')}
          value={range.from}
          max={range.to || undefined}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
        />
      </div>
      <div className="max-w-[12rem]">
        <Input
          id="report-range-to"
          type="date"
          label={t('range.to')}
          value={range.to}
          min={range.from || undefined}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
        />
      </div>
      {(range.from || range.to) && (
        <Button type="button" variant="outline" onClick={() => setRange({ from: '', to: '' })}>
          {t('range.reset')}
        </Button>
      )}
    </div>
  );

  if (!report) {
    return (
      <>
        {rangePicker}
        <p className="text-txt/70">{isLoading ? t('loading') : t('noData')}</p>
      </>
    );
  }

  const { revenue, revenueByBranch, topMovies, refundSummary, revenueByDay } = report;
  const showByBranch = variant === 'system' || revenueByBranch.length > 1;

  const breakdownRows: { label: string; value: number; sign: 1 | -1 }[] = [
    { label: t('breakdown.ticketRevenue'), value: revenue.ticketRevenue, sign: 1 },
    { label: t('breakdown.comboRevenue'), value: revenue.comboRevenue, sign: 1 },
    { label: t('breakdown.discount'), value: revenue.discount, sign: -1 },
    { label: t('breakdown.refund'), value: revenue.refund, sign: -1 },
  ];

  return (
    <div className="space-y-6">
      {rangePicker}

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
