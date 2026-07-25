import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAppSelector } from '@/hooks/redux';
import { resolveConfirm } from './confirm';

export function ConfirmDialog() {
  const { t } = useTranslation('notifications');
  const request = useAppSelector((state) => state.confirm.request);

  if (!request) return null;

  const handleCancel = () => resolveConfirm(request.id, false);
  const handleConfirm = () => resolveConfirm(request.id, true);

  return (
    <Modal open onClose={handleCancel} title={request.title ?? t('confirmDialog.defaultTitle')}>
      <p className="text-sm text-txt/80">{request.message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={handleCancel}>
          {request.cancelLabel ?? t('confirmDialog.cancelLabel')}
        </Button>
        <Button
          type="button"
          variant={request.danger === false ? 'primary' : 'danger'}
          onClick={handleConfirm}
        >
          {request.confirmLabel ?? t('confirmDialog.confirmLabel')}
        </Button>
      </div>
    </Modal>
  );
}
