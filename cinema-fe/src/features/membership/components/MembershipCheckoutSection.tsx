import { useTranslation } from 'react-i18next';
import type { MembershipPreview } from '../types/membership.types';

// The seat page's member block: how many free tickets to use (the customer only picks a count — the
// server decides which seats they cover) and the member discounts, all from the server's preview.
export function MembershipCheckoutSection({
  preview,
  freeTickets,
  onChangeFreeTickets,
}: {
  preview: MembershipPreview | undefined;
  freeTickets: number;
  onChangeFreeTickets: (value: number) => void;
}) {
  const { t } = useTranslation('membership');
  if (!preview) return null;
  const m = preview.membership;
  const available = m.free_tickets.available;
  if (m.total <= 0 && available <= 0) return null;

  const fmt = (value: number) => `-${value.toLocaleString()}đ`;
  const stepButton = 'h-7 w-7 rounded-full border border-border-strong text-white transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="border-b border-border py-4 text-sm" data-testid="membership-checkout">
      <p className="mb-2 flex items-center justify-between text-txt/60">
        <span>
          <i className="fa-solid fa-crown mr-1.5 text-gold" aria-hidden="true" />
          {t('checkout.title')}
        </span>
        {m.level !== 'NONE' && <span className="text-xs text-gold">{t('checkout.level', { level: m.level })}</span>}
      </p>

      {available > 0 && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-white">{t('checkout.freeTicketsLabel')}</p>
            <p className="text-xs text-txt/50">{t('checkout.freeTicketsAvailable', { available })}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={stepButton}
              onClick={() => onChangeFreeTickets(freeTickets - 1)}
              disabled={freeTickets <= 0}
              aria-label={t('checkout.decrease')}
            >
              −
            </button>
            <span className="w-5 text-center font-semibold text-white" data-testid="free-tickets-count">
              {freeTickets}
            </span>
            <button
              type="button"
              className={stepButton}
              onClick={() => onChangeFreeTickets(freeTickets + 1)}
              disabled={freeTickets >= available}
              aria-label={t('checkout.increase')}
            >
              +
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-1 text-emerald-400">
        {m.free_ticket_amount > 0 && (
          <li className="flex justify-between">
            <span>{t('checkout.freeTicketLine', { count: m.free_tickets.applied })}</span>
            <span>{fmt(m.free_ticket_amount)}</span>
          </li>
        )}
        {m.ticket_discount_amount > 0 && (
          <li className="flex justify-between">
            <span>{t('checkout.ticketDiscountLine', { percent: m.ticket_discount_percent })}</span>
            <span>{fmt(m.ticket_discount_amount)}</span>
          </li>
        )}
        {m.fnb_discount_amount > 0 && (
          <li className="flex justify-between">
            <span>{t('checkout.fnbDiscountLine', { percent: m.fnb_discount_percent })}</span>
            <span>{fmt(m.fnb_discount_amount)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
