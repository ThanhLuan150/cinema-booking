import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function CounterSaleCustomerLookup({
  email,
  customerAccountId,
  lookingUp,
  onEmailChange,
  onFindCustomer,
}: {
  email: string;
  customerAccountId: number | null;
  lookingUp: boolean;
  onEmailChange: (value: string) => void;
  onFindCustomer: () => void;
}) {
  const { t } = useTranslation('employee');
  return (
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
  );
}
