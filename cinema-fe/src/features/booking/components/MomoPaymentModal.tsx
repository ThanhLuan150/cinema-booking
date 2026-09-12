import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export function MomoPaymentModal({ payUrl, onClose }: { payUrl: string; onClose: () => void }) {
  const { t } = useTranslation('booking');

  return (
    <Modal open onClose={onClose} title={t('bookSeat.momoModal.title')}>
      <div className="grid grid-cols-1 gap-6 text-txt sm:grid-cols-2">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border-strong p-4 text-center">
          <p className="font-semibold text-white">{t('bookSeat.momoModal.qrTitle')}</p>
          <div className="rounded-md bg-white p-3">
            <QRCodeSVG value={payUrl} size={180} />
          </div>
          <p className="text-sm text-txt/60">{t('bookSeat.momoModal.qrDescription')}</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-strong p-4 text-center">
          <p className="font-semibold text-white">{t('bookSeat.momoModal.testAccountTitle')}</p>
          <p className="text-sm text-txt/60">
            {t('bookSeat.momoModal.testAccountDescription')}
          </p>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              window.location.href = payUrl;
            }}
          >
            {t('bookSeat.momoModal.openButton')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
