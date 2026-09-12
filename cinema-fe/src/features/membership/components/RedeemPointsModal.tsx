import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useRedeemPoints } from '../hooks/useRedeemPoints';

export function RedeemPointsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('membership');
  const [redeemInput, setRedeemInput] = useState('');
  const redeemMutation = useRedeemPoints();

  const handleRedeem = async () => {
    const points = Number(redeemInput);
    if (!Number.isInteger(points) || points <= 0) {
      toast.error(t('redeem.invalidAmount'));
      return;
    }
    if (!(await confirmDialog(t('redeem.confirm', { points })))) return;
    try {
      const result = await redeemMutation.mutateAsync({ points });
      toast.success(t('redeem.success', { value: result.redeemValue.toLocaleString() }));
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={t('redeem.modalTitle')}>
      <Input
        id="redeem-points"
        type="number"
        min={1}
        label={t('redeem.inputLabel')}
        value={redeemInput}
        onChange={(e) => setRedeemInput(e.target.value)}
      />
      <div className="mt-6 flex justify-end">
        <Button type="button" onClick={handleRedeem} loading={redeemMutation.isPending}>
          {t('redeem.submit')}
        </Button>
      </div>
    </Modal>
  );
}
