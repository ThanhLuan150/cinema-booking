import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { KioskQuote } from '../types/kiosk.types';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={cn('text-txt/70', strong && 'font-semibold text-white')}>{label}</span>
      <span className={cn('text-white', strong && 'text-lg font-bold text-accent')}>{value}</span>
    </div>
  );
}

export function PaymentStep({
  quote,
  seatTotal,
  comboTotal,
  paying,
  busy,
  onBack,
  onPay,
  onFinish,
}: {
  quote: KioskQuote | null;
  seatTotal: number;
  comboTotal: number;
  paying: boolean;
  busy: boolean;
  onBack: () => void;
  onPay: () => void;
  onFinish: (outcome: 'SUCCESS' | 'FAILURE', method: 'CARD' | 'QR_PAYMENT') => void;
}) {
  const { t } = useTranslation('kiosk');
  return (
    <section className="max-w-md">
      <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.payment')}</h2>
      <div className="rounded-xl border border-border bg-surface p-5 text-sm">
        <Row label={t('payment.seats')} value={`${(quote?.seatTotal ?? seatTotal).toLocaleString()}đ`} />
        <Row label={t('payment.combos')} value={`${(quote?.comboTotal ?? comboTotal).toLocaleString()}đ`} />
        {(quote?.discountAmount ?? 0) > 0 && (
          <Row label={t('payment.discount')} value={`-${(quote?.discountAmount ?? 0).toLocaleString()}đ`} />
        )}
        <div className="mt-3 border-t border-border pt-3">
          <Row
            label={t('payment.total')}
            value={`${(quote?.totalPrice ?? seatTotal + comboTotal).toLocaleString()}đ`}
            strong
          />
        </div>
      </div>

      {!paying ? (
        <div className="mt-6 flex gap-3">
          <Button type="button" variant="outline" onClick={onBack}>
            {t('back')}
          </Button>
          <Button type="button" variant="danger" loading={busy} onClick={onPay}>
            {t('payment.pay')}
          </Button>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-border p-5">
          <p className="mb-3 text-sm text-txt/70">{t('payment.terminalPrompt')}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="danger" loading={busy} onClick={() => onFinish('SUCCESS', 'CARD')}>
              {t('payment.simCardOk')}
            </Button>
            <Button type="button" variant="secondary" loading={busy} onClick={() => onFinish('SUCCESS', 'QR_PAYMENT')}>
              {t('payment.simQrOk')}
            </Button>
            <Button type="button" variant="outline" loading={busy} onClick={() => onFinish('FAILURE', 'CARD')}>
              {t('payment.simFail')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
