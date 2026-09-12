import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useAppDispatch } from '@/hooks/redux';
import { clearVoucher, setVoucherCode } from '../store/bookingSlice';
import type { PromotionValidationResult, VoucherValidationResult } from '../types/booking.types';
import type { GiftCardValidationResult } from '@/features/giftCards/types/giftCard.types';

export function VoucherSection({
  voucherCode,
  voucherResult,
  voucherError,
  promotionResult,
  giftCardPreview,
  onApply,
}: {
  voucherCode: string;
  voucherResult: VoucherValidationResult | null;
  voucherError: string;
  promotionResult: PromotionValidationResult | null;
  giftCardPreview: GiftCardValidationResult | null;
  onApply: () => void;
}) {
  const { t } = useTranslation('booking');
  const dispatch = useAppDispatch();

  return (
    <div className="border-b border-border py-4">
      <p className="mb-2 text-sm text-txt/60">{t('voucher.title')}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={voucherCode}
          onChange={(e) => dispatch(setVoucherCode(e.target.value))}
          placeholder={t('voucher.placeholder')}
          disabled={!!promotionResult || !!giftCardPreview}
          className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-soft px-3 py-2 text-sm text-txt placeholder:text-txt/35 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onApply}
          disabled={!!promotionResult || !!giftCardPreview}
        >
          {t('voucher.apply')}
        </Button>
      </div>
      {voucherResult && (
        <p className="mt-2 flex items-center gap-2 text-sm text-emerald-400">
          {t('voucher.applied', {
            amount: `${voucherResult.discount_amount.toLocaleString()}đ`,
          })}
          <button
            type="button"
            onClick={() => dispatch(clearVoucher())}
            className="text-txt/50 underline transition-colors hover:text-txt"
          >
            {t('voucher.remove')}
          </button>
        </p>
      )}
      {voucherError && <p className="mt-2 text-sm text-red-400">{voucherError}</p>}
      {promotionResult && <p className="mt-2 text-sm text-txt/50">{t('voucher.disabledHint')}</p>}
      {giftCardPreview && <p className="mt-2 text-sm text-txt/50">{t('voucher.disabledByGiftCardHint')}</p>}
    </div>
  );
}
