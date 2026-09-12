import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { getMoviePosterUrl } from '@/utils';
import { SeatHoldCountdown } from './SeatHoldCountdown';
import { VoucherSection } from './VoucherSection';
import { PromotionSection } from './PromotionSection';
import { GiftCardSection } from './GiftCardSection';
import type { PromotionValidationResult, VoucherValidationResult } from '../types/booking.types';
import type { GiftCardValidationResult } from '@/features/giftCards/types/giftCard.types';
import type { Movie } from '@/types/entities';

export function BookingSummarySidebar({
  movie,
  movieDate,
  timeBegin,
  selectedSeatCodes,
  earliestHoldExpiry,
  onHoldExpire,
  voucherCode,
  voucherResult,
  voucherError,
  onApplyVoucher,
  promotionCode,
  promotionResult,
  promotionError,
  onApplyPromotion,
  giftCardCode,
  giftCardPreview,
  giftCardError,
  giftCardApplyLoading,
  giftCardPayLoading,
  onChangeGiftCardCode,
  onApplyGiftCard,
  onClearGiftCard,
  onPayWithGiftCard,
  totalPrice,
  onCheckout,
  checkoutLoading,
}: {
  movie: Movie | undefined;
  movieDate: string;
  timeBegin: string;
  selectedSeatCodes: string[];
  earliestHoldExpiry: string | null;
  onHoldExpire: () => void;
  voucherCode: string;
  voucherResult: VoucherValidationResult | null;
  voucherError: string;
  onApplyVoucher: () => void;
  promotionCode: string;
  promotionResult: PromotionValidationResult | null;
  promotionError: string;
  onApplyPromotion: () => void;
  giftCardCode: string;
  giftCardPreview: GiftCardValidationResult | null;
  giftCardError: string;
  giftCardApplyLoading: boolean;
  giftCardPayLoading: boolean;
  onChangeGiftCardCode: (value: string) => void;
  onApplyGiftCard: () => void;
  onClearGiftCard: () => void;
  onPayWithGiftCard: () => void;
  totalPrice: number;
  onCheckout: () => void;
  checkoutLoading: boolean;
}) {
  const { t } = useTranslation('booking');

  return (
    <aside className="h-fit rounded-2xl border border-border bg-surface p-6 shadow-raised lg:sticky lg:top-24">
      <h2 className="mb-4 flex items-center gap-3 text-base font-bold uppercase tracking-wide text-white">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        {t('bookSeat.summaryTitle')}
      </h2>

      <div className="flex gap-3 border-b border-border pb-4">
        {movie?.avatar && (
          <img
            src={getMoviePosterUrl(movie.avatar)}
            alt={movie.name}
            className="aspect-[2/3] w-16 shrink-0 rounded-lg object-cover shadow-card"
          />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">
            {movie?.name || t('bookSeat.defaultTitle')}
          </p>
          <p className="mt-1 text-sm text-txt/60">
            <i className="fa-regular fa-calendar mr-1.5 text-accent" />
            {movieDate}
          </p>
          <p className="mt-0.5 text-sm text-txt/60">
            <i className="fa-regular fa-clock mr-1.5 text-accent" />
            {timeBegin}
          </p>
        </div>
      </div>

      <div className="border-b border-border py-4 text-sm">
        <p className="text-txt/60">{t('bookSeat.selectedSeatsLabel')}</p>
        <p className="mt-1 font-semibold text-white">
          {selectedSeatCodes.length > 0
            ? selectedSeatCodes.join(', ')
            : t('bookSeat.noneSelected')}
        </p>
        {earliestHoldExpiry && (
          <div className="mt-3">
            <SeatHoldCountdown expiresAt={earliestHoldExpiry} onExpire={onHoldExpire} />
          </div>
        )}
      </div>

      <VoucherSection
        voucherCode={voucherCode}
        voucherResult={voucherResult}
        voucherError={voucherError}
        promotionResult={promotionResult}
        giftCardPreview={giftCardPreview}
        onApply={onApplyVoucher}
      />

      <PromotionSection
        promotionCode={promotionCode}
        promotionResult={promotionResult}
        promotionError={promotionError}
        voucherResult={voucherResult}
        giftCardPreview={giftCardPreview}
        onApply={onApplyPromotion}
      />

      <GiftCardSection
        giftCardCode={giftCardCode}
        giftCardPreview={giftCardPreview}
        giftCardError={giftCardError}
        voucherResult={voucherResult}
        promotionResult={promotionResult}
        applyLoading={giftCardApplyLoading}
        payLoading={giftCardPayLoading}
        onChangeCode={onChangeGiftCardCode}
        onApply={onApplyGiftCard}
        onClear={onClearGiftCard}
        onPay={onPayWithGiftCard}
      />

      <div className="flex items-end justify-between py-4">
        <span className="text-sm uppercase tracking-wide text-txt/60">
          {t('bookSeat.totalLabel')}
        </span>
        <span className="text-2xl font-bold text-accent">
          {totalPrice.toLocaleString()}đ
        </span>
      </div>

      <Button
        type="button"
        className="w-full uppercase"
        size="lg"
        onClick={onCheckout}
        loading={checkoutLoading}
      >
        {t('bookSeat.checkout')}
      </Button>
    </aside>
  );
}
