import { useTranslation } from 'react-i18next';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { CurrentCashierShiftResponse } from '../types/cashierShift.types';
import { money } from '../utils/format';

export function CurrentShiftCard({
  current,
  canClose,
  onOpen,
  onClose,
}: {
  current: CurrentCashierShiftResponse | undefined;
  canClose: boolean;
  onOpen: () => void;
  onClose: (shiftId: number) => void;
}) {
  const { t } = useTranslation('cashierShift');
  return (
    <Card className="mb-6">
      <CardBody>
        <CardTitle>{t('currentShift.title')}</CardTitle>
        {!current?.shift ? (
          <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-txt/60">{t('currentShift.noShiftOpen')}</p>
            <Button type="button" variant="danger" onClick={onOpen}>
              {t('currentShift.openButton')}
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-txt/60">{t('reconciliation.openingCash')}</dt>
                <dd className="font-semibold">{money(current.reconciliation?.openingCash ?? null)}</dd>
              </div>
              <div>
                <dt className="text-txt/60">{t('reconciliation.cashSales')}</dt>
                <dd className="font-semibold">{money(current.reconciliation?.cashSales ?? null)}</dd>
              </div>
              <div>
                <dt className="text-txt/60">{t('reconciliation.cashRefunds')}</dt>
                <dd className="font-semibold">{money(current.reconciliation?.cashRefunds ?? null)}</dd>
              </div>
              <div>
                <dt className="text-txt/60">{t('reconciliation.expectedCash')}</dt>
                <dd className="font-semibold text-accent">{money(current.reconciliation?.expectedCash ?? null)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-txt/50">
              {t('currentShift.openedAt', { time: new Date(current.shift.opened_at).toLocaleString() })}
            </p>
            {canClose && (
              <Button type="button" variant="danger" className="mt-4" onClick={() => onClose(current.shift!.id)}>
                {t('currentShift.closeButton')}
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
