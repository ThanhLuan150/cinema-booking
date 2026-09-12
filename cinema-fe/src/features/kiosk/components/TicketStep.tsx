import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/Button';
import type { KioskTicketView } from '../types/kiosk.types';

export function TicketStep({
  tickets,
  onPrint,
  onDone,
}: {
  tickets: KioskTicketView[];
  onPrint: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation('kiosk');
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-white">{t('ticket.title')}</h2>
      <p className="mb-6 text-sm text-txt/60">{t('ticket.hint')}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tickets.map((ticket) => (
          <div key={ticket.ticket_id} className="flex items-center gap-4 rounded-xl border border-border-strong p-4">
            {ticket.qr_token && <QRCodeSVG value={ticket.qr_token} size={96} />}
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold text-white">{ticket.movie?.name}</p>
              <p className="text-txt/70">
                {ticket.schedule?.movie_date} {ticket.schedule?.time_begin}
              </p>
              <p className="text-txt/70">{t('ticket.seat', { code: ticket.seat_code })}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex gap-3 print:hidden">
        <Button type="button" variant="secondary" onClick={onPrint}>
          {t('ticket.print')}
        </Button>
        <Button type="button" variant="danger" onClick={onDone}>
          {t('ticket.done')}
        </Button>
      </div>
    </section>
  );
}
