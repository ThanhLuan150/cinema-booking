import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { BoxOfficePaymentMethod } from '../types/boxOffice.types';
import { PAYMENT_METHODS } from '../constants';

export function BoxOfficeCheckoutForm({
  voucherCode,
  promotionCode,
  method,
  email,
  customerAccountId,
  lookingUp,
  estimatedTotal,
  sellPending,
  submitDisabled,
  onVoucherCodeChange,
  onPromotionCodeChange,
  onMethodChange,
  onEmailChange,
  onFindCustomer,
  onSubmit,
}: {
  voucherCode: string;
  promotionCode: string;
  method: BoxOfficePaymentMethod;
  email: string;
  customerAccountId: number | null;
  lookingUp: boolean;
  estimatedTotal: number;
  sellPending: boolean;
  submitDisabled: boolean;
  onVoucherCodeChange: (value: string) => void;
  onPromotionCodeChange: (value: string) => void;
  onMethodChange: (method: BoxOfficePaymentMethod) => void;
  onEmailChange: (value: string) => void;
  onFindCustomer: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation('employee');
  return (
    <>
      <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
        <Input
          label={t('boxOffice.voucherLabel')}
          value={voucherCode}
          disabled={Boolean(promotionCode)}
          onChange={(e) => onVoucherCodeChange(e.target.value)}
        />
        <Input
          label={t('boxOffice.promotionLabel')}
          value={promotionCode}
          disabled={Boolean(voucherCode)}
          onChange={(e) => onPromotionCodeChange(e.target.value)}
        />
      </div>

      <div className="mt-6 max-w-md">
        <Select
          label={t('boxOffice.methodLabel')}
          value={method}
          onChange={(e) => onMethodChange(e.target.value as BoxOfficePaymentMethod)}
          options={PAYMENT_METHODS.map((m) => ({ label: t(`boxOffice.methods.${m}`), value: m }))}
        />
      </div>

      <div className="mt-6 max-w-md">
        <h6 className="mb-3 font-semibold text-white">{t('counterSale.customerTitle')}</h6>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder={t('counterSale.customerEmailPlaceholder')}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
          <Button type="button" variant="secondary" loading={lookingUp} onClick={onFindCustomer}>
            {t('counterSale.findCustomer')}
          </Button>
        </div>
        {customerAccountId && <p className="mt-2 text-sm text-emerald-400">{t('counterSale.customerFound')}</p>}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <p className="text-lg font-bold text-accent">
          {t('counterSale.total')}: {estimatedTotal.toLocaleString()}đ
        </p>
        <Button
          type="button"
          variant="danger"
          loading={sellPending}
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          {t('boxOffice.pay')}
        </Button>
      </div>
    </>
  );
}
