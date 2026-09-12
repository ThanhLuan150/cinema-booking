import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import type { LookedUpInvoice } from '../types/employee.types';

export function CheckInCodeLookupPanel({
  code,
  invoice,
  isFetching,
  error,
  checkInPending,
  onCodeChange,
  onLookup,
  onCheckIn,
}: {
  code: string;
  invoice: LookedUpInvoice | undefined;
  isFetching: boolean;
  error: unknown;
  checkInPending: boolean;
  onCodeChange: (value: string) => void;
  onLookup: () => void;
  onCheckIn: () => void;
}) {
  const { t } = useTranslation('employee');
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-txt/60">
        {t('checkIn.codeSectionTitle')}
      </h2>
      <div className="flex gap-2">
        <Input
          placeholder={t('checkIn.codePlaceholder')}
          value={code}
          onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
        />
        <Button type="button" variant="secondary" loading={isFetching} onClick={onLookup}>
          {t('checkIn.lookup')}
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-400">{t('checkIn.notFound')}</p> : null}

      {invoice && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-card">
          <p className="font-semibold text-white">{invoice.movie?.name}</p>
          <p className="text-sm text-txt/70">{invoice.cinema?.name}</p>
          <p className="text-sm text-txt/70">
            {invoice.schedule?.movie_date} {invoice.schedule?.time_begin}
          </p>
          <p className="text-sm text-txt/70">{invoice.ticket?.seat_code}</p>
          <div className="mt-2">
            {invoice.checked_in ? (
              <Badge variant="success">{t('checkIn.statusCheckedIn')}</Badge>
            ) : invoice.status === 1 ? (
              <Badge variant="default">{t('checkIn.statusPaid')}</Badge>
            ) : (
              <Badge variant="default">{t('checkIn.statusNotPaid')}</Badge>
            )}
          </div>
          <Button
            type="button"
            variant="danger"
            className="mt-4"
            loading={checkInPending}
            disabled={invoice.checked_in || invoice.status !== 1}
            onClick={onCheckIn}
          >
            {t('checkIn.confirmCheckIn')}
          </Button>
        </div>
      )}
    </div>
  );
}
