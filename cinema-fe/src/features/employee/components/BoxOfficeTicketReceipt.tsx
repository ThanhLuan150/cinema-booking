import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/Button';
import { useBoxOfficeBookingTickets } from '../hooks/useBoxOfficeBookingTickets';

export function BoxOfficeTicketReceipt({ bookingId, onPrint }: { bookingId: number; onPrint: () => void }) {
  const { t } = useTranslation('employee');
  const { data } = useBoxOfficeBookingTickets(bookingId);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-card print:border-none print:shadow-none">
      <div className="mb-4 flex items-center justify-between">
        <h6 className="font-semibold text-white">{t('boxOffice.receipt.title')}</h6>
        <Button type="button" variant="secondary" onClick={onPrint} className="print:hidden">
          {t('boxOffice.receipt.print')}
        </Button>
      </div>
      {!data ? (
        <p className="text-sm text-txt/60">{t('boxOffice.receipt.loading')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.tickets.map((ticket) => (
            <div key={ticket.ticket_id} className="flex items-center gap-4 rounded-lg border border-border-strong p-4">
              {ticket.qr_token && <QRCodeSVG value={ticket.qr_token} size={72} />}
              <div className="min-w-0 text-sm">
                <p className="truncate font-semibold text-white">{ticket.movie?.name}</p>
                <p className="text-txt/70">
                  {ticket.schedule?.movie_date} {ticket.schedule?.time_begin}
                </p>
                <p className="text-txt/70">{t('boxOffice.receipt.seat', { code: ticket.seat_code })}</p>
                <p className="text-txt/70">{data.booking.code}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
