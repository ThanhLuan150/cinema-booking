import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useAppDispatch } from '@/hooks/redux';
import { clearPromotion, setPromotionCode } from '../store/bookingSlice';
import type { PromotionValidationResult, VoucherValidationResult } from '../types/booking.types';
import type { GiftCardValidationResult } from '@/features/giftCards/types/giftCard.types';

export function PromotionSection({
  promotionCode,
  promotionResult,
  promotionError,
  voucherResult,
  giftCardPreview,
  onApply,
}: {
  promotionCode: string;
  promotionResult: PromotionValidationResult | null;
  promotionError: string;
  voucherResult: VoucherValidationResult | null;
  giftCardPreview: GiftCardValidationResult | null;
  onApply: () => void;
}) {
  const { t } = useTranslation('booking');
  const dispatch = useAppDispatch();

  return (
    <div className="border-b border-border py-4">
      <p className="mb-2 text-sm text-txt/60">{t('promotion.title')}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={promotionCode}
          onChange={(e) => dispatch(setPromotionCode(e.target.value))}
          placeholder={t('promotion.placeholder')}
          disabled={!!voucherResult || !!giftCardPreview}
          className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-soft px-3 py-2 text-sm text-txt placeholder:text-txt/35 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onApply}
          disabled={!!voucherResult || !!giftCardPreview}
        >
          {t('promotion.apply')}
        </Button>
      </div>
      {promotionResult && (
        <p className="mt-2 flex items-center gap-2 text-sm text-emerald-400">
          {t('promotion.applied', {
            amount: `${promotionResult.discount_amount.toLocaleString()}đ`,
          })}
          <button
            type="button"
            onClick={() => dispatch(clearPromotion())}
            className="text-txt/50 underline transition-colors hover:text-txt"
          >
            {t('promotion.remove')}
          </button>
        </p>
      )}
      {promotionError && <p className="mt-2 text-sm text-red-400">{promotionError}</p>}
      {voucherResult && <p className="mt-2 text-sm text-txt/50">{t('promotion.disabledHint')}</p>}
      {giftCardPreview && <p className="mt-2 text-sm text-txt/50">{t('promotion.disabledByGiftCardHint')}</p>}
    </div>
  );
}
