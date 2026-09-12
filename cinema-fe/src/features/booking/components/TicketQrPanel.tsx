import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { CardBody } from '@/components/ui/Card';

export function TicketQrPanel({ qrToken }: { qrToken: string | null | undefined }) {
  const { t } = useTranslation('booking');

  return (
    <CardBody className="flex flex-col items-center gap-3 border-t border-border bg-white/[0.02] py-8">
      <p className="text-sm text-txt/60">{t('ticketDetail.qrHint')}</p>
      {qrToken ? (
        <div className="rounded-xl bg-white p-4">
          <QRCodeSVG value={qrToken} size={180} />
        </div>
      ) : (
        <p className="text-sm text-txt/50">{t('ticketDetail.qrUnavailable')}</p>
      )}
    </CardBody>
  );
}
