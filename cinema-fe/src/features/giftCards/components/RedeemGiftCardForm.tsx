import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useRedeemGiftCard } from '../hooks/useRedeemGiftCard';

export function RedeemGiftCardForm() {
  const { t } = useTranslation('giftCards');
  const [redeemCode, setRedeemCode] = useState('');
  const redeemMutation = useRedeemGiftCard();

  const handleRedeem = async () => {
    const code = redeemCode.trim();
    if (!code) return;
    try {
      await redeemMutation.mutateAsync(code);
      toast.success(t('redeem.success'));
      setRedeemCode('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
      <h2 className="mb-3 text-base font-semibold text-white">{t('redeem.title')}</h2>
      <p className="mb-4 text-sm text-txt/60">{t('redeem.description')}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="redeem-gift-card-code"
          value={redeemCode}
          onChange={(e) => setRedeemCode(e.target.value)}
          placeholder={t('redeem.placeholder')}
          className="flex-1"
        />
        <Button type="button" onClick={handleRedeem} loading={redeemMutation.isPending}>
          {t('redeem.button')}
        </Button>
      </div>
    </div>
  );
}
