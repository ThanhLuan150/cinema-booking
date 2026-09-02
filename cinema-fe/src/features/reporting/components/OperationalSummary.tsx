import { useTranslation } from 'react-i18next';
import { useOperationalReport } from '../hooks/useOperationalReport';
import type { OperationalMetricKey } from '../types/reporting.types';

export interface OperationalSummaryProps {
  branchId?: string;
}

const METRIC_ORDER: OperationalMetricKey[] = [
  'showtimesToday',
  'ticketsIssuedToday',
  'ticketsCheckedInToday',
  'pendingComboOrders',
  'openMaintenance',
];

export function OperationalSummary({ branchId }: OperationalSummaryProps) {
  const { t } = useTranslation('reporting');
  const { data: report } = useOperationalReport(branchId);

  const metrics = report?.metrics;
  if (!metrics) return null;

  const tiles = METRIC_ORDER.filter((key) => metrics[key] !== undefined);
  if (tiles.length === 0) return null;

  return (
    <section className="mb-6">
      <h6 className="mb-3 font-semibold text-white">{t('operational.title')}</h6>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {tiles.map((key) => (
          <div key={key} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <p className="text-sm text-txt/60">{t(`operational.${key}`)}</p>
            <p className="mt-1 text-xl font-bold text-white">{metrics[key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
