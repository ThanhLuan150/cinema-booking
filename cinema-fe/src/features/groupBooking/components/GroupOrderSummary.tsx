import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import type { GroupBookingQuote } from '../types/groupBooking.types';

const formatVnd = (value: number) => `${value.toLocaleString()}đ`;

/**
 * The order as the server prices it (never computed here): seats, combo lines, the discount — the
 * group promotion picked automatically, or the code typed in — and the one total paid for everyone.
 */
export function GroupOrderSummary({
  quote,
  quoting,
  quoteError,
  selectedCount,
  promotionCode,
  onPromotionCodeChange,
  onPay,
  paying,
  canPay,
}: {
  quote: GroupBookingQuote | undefined;
  quoting: boolean;
  quoteError: string;
  selectedCount: number;
  promotionCode: string;
  onPromotionCodeChange: (code: string) => void;
  onPay: () => void;
  paying: boolean;
  canPay: boolean;
}) {
  const { t } = useTranslation('groupBooking');

  return (
    <aside className="flex h-fit flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card lg:sticky lg:top-24">
      <h2 className="flex items-center gap-3 text-base font-bold uppercase tracking-wide text-white">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        {t('summary.title')}
        {quoting && <Spinner size="sm" />}
      </h2>

      <p className="text-sm text-txt/70" data-testid="group-seat-count">
        {t('summary.seatsSelected', { count: selectedCount })}
        {quote && ` · ${t('summary.limits', { min: quote.limits.min_seats, max: quote.limits.max_seats })}`}
      </p>

      {quoteError && <Alert variant="warning">{quoteError}</Alert>}

      {quote && (
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-txt/70">{t('summary.seats', { count: quote.seat_count })}</dt>
            <dd className="text-white">{formatVnd(quote.seat_total)}</dd>
          </div>
          {quote.combos.map((line) => (
            <div key={line.combo_id} className="flex justify-between gap-3">
              <dt className="text-txt/70">{t('summary.comboLine', { name: line.name, quantity: line.quantity })}</dt>
              <dd className="text-white">{formatVnd(line.line_total)}</dd>
            </div>
          ))}
          {quote.discount && (
            <div className="flex justify-between gap-3 text-accent" data-testid="group-discount">
              <dt>
                {t(`summary.discount.${quote.discount.source}`, {
                  code: quote.discount.code,
                  name: quote.discount.name,
                  min: quote.discount.min_tickets,
                })}
              </dt>
              <dd>−{formatVnd(quote.discount.amount)}</dd>
            </div>
          )}
          <div className="mt-2 flex justify-between gap-3 border-t border-border pt-3 text-base font-bold">
            <dt className="text-white">{t('summary.total')}</dt>
            <dd className="text-white" data-testid="group-total">
              {formatVnd(quote.total_price)}
            </dd>
          </div>
        </dl>
      )}

      {quote && quote.unavailable_seat_codes.length > 0 && (
        <Alert variant="error">{t('summary.unavailable', { seats: quote.unavailable_seat_codes.join(', ') })}</Alert>
      )}
      {quote &&
        quote.stock_shortages.map((shortage) => (
          <Alert key={shortage.combo_id} variant="warning">
            {t('summary.shortage', { item: shortage.item, available: shortage.available })}
          </Alert>
        ))}

      <Input
        id="group_promotion_code"
        label={t('summary.promotionCode')}
        placeholder={t('summary.promotionPlaceholder')}
        value={promotionCode}
        onChange={(event) => onPromotionCodeChange(event.target.value)}
      />
      <p className="-mt-2 text-xs text-txt/50">{t('summary.promotionHint')}</p>

      <Button type="button" onClick={onPay} disabled={!canPay || paying} loading={paying}>
        <i className="fa-solid fa-wallet mr-2" aria-hidden="true" />
        {t('summary.pay')}
      </Button>
      <p className="text-xs text-txt/50">{t('summary.payHint')}</p>
    </aside>
  );
}
