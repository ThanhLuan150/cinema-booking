import { useTranslation } from 'react-i18next';
import { SEAT_TYPES } from '@/constants/seatType';
import type { LookedUpInvoice } from '../../types/owner.types';

interface LookupInvoiceCardProps {
  invoice: LookedUpInvoice;
}

export function LookupInvoiceCard({ invoice }: LookupInvoiceCardProps) {
  const { t } = useTranslation('owner');

  const STATUS_LABEL = t('bookingsLookup.statusLabels', { returnObjects: true }) as unknown as string[];
  const SEAT_TYPE_LABEL = t('bookingsLookup.seatTypeLabels', { returnObjects: true }) as unknown as string[];

  return (
    <div className="mt-6 max-w-md rounded-xl border border-border bg-surface p-5 text-white shadow-card">
      <p>
        <b>{t('bookingsLookup.ticketCode')}</b> {invoice.code}
      </p>
      <p>
        <b>{t('bookingsLookup.movie')}</b> {invoice.movie?.name}
      </p>
      <p>
        <b>{t('bookingsLookup.cinema')}</b> {invoice.cinema?.name}
      </p>
      <p>
        <b>{t('bookingsLookup.schedule')}</b> {invoice.schedule?.movie_date} · {invoice.schedule?.time_begin}
      </p>
      <p>
        <b>{t('bookingsLookup.seat')}</b> {invoice.ticket?.seat_code} ({SEAT_TYPE_LABEL[invoice.ticket?.seat_type ?? SEAT_TYPES.standard] ?? SEAT_TYPE_LABEL[SEAT_TYPES.standard]})
      </p>
      <p>
        <b>{t('bookingsLookup.status')}</b> {STATUS_LABEL[invoice.status]}
      </p>
      <p>
        <b>{t('bookingsLookup.totalPrice')}</b> {invoice.total_price.toLocaleString()}đ
      </p>
    </div>
  );
}
