import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function PromoStep({
  voucherCode,
  promotionCode,
  busy,
  onVoucherCodeChange,
  onPromotionCodeChange,
  onBack,
  onReview,
}: {
  voucherCode: string;
  promotionCode: string;
  busy: boolean;
  onVoucherCodeChange: (value: string) => void;
  onPromotionCodeChange: (value: string) => void;
  onBack: () => void;
  onReview: () => void;
}) {
  const { t } = useTranslation('kiosk');
  return (
    <section className="max-w-md">
      <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.promo')}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t('promo.voucher')}
          value={voucherCode}
          disabled={Boolean(promotionCode)}
          onChange={(e) => onVoucherCodeChange(e.target.value)}
        />
        <Input
          label={t('promo.promotion')}
          value={promotionCode}
          disabled={Boolean(voucherCode)}
          onChange={(e) => onPromotionCodeChange(e.target.value)}
        />
      </div>
      <p className="mt-3 text-xs text-txt/50">{t('promo.hint')}</p>
      <div className="mt-6 flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          {t('back')}
        </Button>
        <Button type="button" variant="danger" loading={busy} onClick={onReview}>
          {t('promo.review')}
        </Button>
      </div>
    </section>
  );
}
