import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/format';
import type { MembershipBenefits } from '../types/membership.types';

// One line per benefit that actually gives something. `freeTicketsPer` says what a free-ticket
// allowance is counted against: a tier's is per month, a plan's per term.
export function BenefitsList({
  benefits,
  freeTicketsPer,
  className = '',
}: {
  benefits: Partial<MembershipBenefits> | undefined;
  freeTicketsPer: 'month' | 'term';
  className?: string;
}) {
  const { t } = useTranslation('membership');
  const b = benefits ?? {};
  const lines: { key: string; icon: string; text: string }[] = [];

  if ((b.free_tickets ?? 0) > 0) {
    const perLabel = t(freeTicketsPer === 'month' ? 'benefits.perMonth' : 'benefits.perTerm');
    lines.push({
      key: 'free',
      icon: 'fa-ticket',
      text:
        b.free_ticket_max_value != null
          ? t('benefits.freeTicketsCapped', { count: b.free_tickets, per: perLabel, cap: formatCurrency(b.free_ticket_max_value) })
          : t('benefits.freeTickets', { count: b.free_tickets, per: perLabel }),
    });
  }
  if ((b.ticket_discount_percent ?? 0) > 0) {
    lines.push({ key: 'ticket', icon: 'fa-percent', text: t('benefits.ticketDiscount', { percent: b.ticket_discount_percent }) });
  }
  if ((b.fnb_discount_percent ?? 0) > 0) {
    lines.push({ key: 'fnb', icon: 'fa-burger', text: t('benefits.fnbDiscount', { percent: b.fnb_discount_percent }) });
  }
  if ((b.priority_booking_hours ?? 0) > 0) {
    lines.push({ key: 'priority', icon: 'fa-bolt', text: t('benefits.priorityBooking', { hours: b.priority_booking_hours }) });
  }
  if ((b.points_multiplier ?? 1) > 1) {
    lines.push({ key: 'points', icon: 'fa-star', text: t('benefits.pointsMultiplier', { multiplier: b.points_multiplier }) });
  }

  if (lines.length === 0) {
    return <p className={`text-sm text-txt/50 ${className}`}>{t('benefits.none')}</p>;
  }
  return (
    <ul className={`space-y-1.5 text-sm text-txt/80 ${className}`}>
      {lines.map((line) => (
        <li key={line.key} className="flex items-start gap-2">
          <i className={`fa-solid ${line.icon} mt-0.5 w-4 text-center text-accent`} aria-hidden="true" />
          <span>{line.text}</span>
        </li>
      ))}
    </ul>
  );
}
