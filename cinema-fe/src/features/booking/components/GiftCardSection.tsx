import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { PromotionValidationResult, VoucherValidationResult } from '../types/booking.types';
import type { GiftCardValidationResult } from '@/features/giftCards/types/giftCard.types';

export function GiftCardSection({
  giftCardCode,
  giftCardPreview,
  giftCardError,
  voucherResult,
  promotionResult,
  applyLoading,
  payLoading,
  onChangeCode,
  onApply,
  onClear,
  onPay,
}: {
  giftCardCode: string;
  giftCardPreview: GiftCardValidationResult | null;
  giftCardError: string;
  voucherResult: VoucherValidationResult | null;
  promotionResult: PromotionValidationResult | null;
  applyLoading: boolean;
  payLoading: boolean;
  onChangeCode: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onPay: () => void;
}) {
  const { t } = useTranslation('booking');

  return (
    <div className="border-b border-border py-4">
      <p className="mb-2 text-sm text-txt/60">{t('giftCard.title')}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={giftCardCode}
          onChange={(e) => onChangeCode(e.target.value)}
          placeholder={t('giftCard.placeholder')}
          disabled={!!voucherResult || !!promotionResult}
          className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-soft px-3 py-2 text-sm text-txt placeholder:text-txt/35 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onApply}
          disabled={!!voucherResult || !!promotionResult}
          loading={applyLoading}
        >
          {t('giftCard.apply')}
        </Button>
      </div>
      {giftCardPreview && (
        <>
          <p className="mt-2 flex items-center gap-2 text-sm text-emerald-400">
            {t('giftCard.applicable', {
              amount: `${giftCardPreview.applicable_amount.toLocaleString()}${giftCardPreview.currency}`,
            })}
            <button
              type="button"
              onClick={onClear}
              className="text-txt/50 underline transition-colors hover:text-txt"
            >
              {t('giftCard.remove')}
            </button>
          </p>
          <Button
            type="button"
            variant="danger"
            size="sm"
            className="mt-3 w-full"
            onClick={onPay}
            loading={payLoading}
          >
            {t('giftCard.payButton')}
          </Button>
        </>
      )}
      {giftCardError && <p className="mt-2 text-sm text-red-400">{giftCardError}</p>}
      {(voucherResult || promotionResult) && (
        <p className="mt-2 text-sm text-txt/50">{t('giftCard.disabledHint')}</p>
      )}
    </div>
  );
}
