import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import type { MembershipBenefits } from '@/features/membership/types/membership.types';
import type { BenefitsDraft } from '../utils/benefitsDraft';

export function BenefitsFields({
  idPrefix,
  draft,
  onChange,
  freeTicketsLabel,
}: {
  idPrefix: string;
  draft: BenefitsDraft;
  onChange: (draft: BenefitsDraft) => void;
  freeTicketsLabel: string;
}) {
  const { t } = useTranslation('membership');
  const field = (key: keyof MembershipBenefits, label: string, props: { min?: number; max?: number; step?: string } = {}) => (
    <Input
      id={`${idPrefix}-${key}`}
      type="number"
      label={label}
      value={draft[key]}
      onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
      {...props}
    />
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {field('ticket_discount_percent', t('admin.fields.ticketDiscount'), { min: 0, max: 100 })}
      {field('fnb_discount_percent', t('admin.fields.fnbDiscount'), { min: 0, max: 100 })}
      {field('free_tickets', freeTicketsLabel, { min: 0, max: 100 })}
      {field('free_ticket_max_value', t('admin.fields.freeTicketCap'), { min: 0 })}
      {field('priority_booking_hours', t('admin.fields.priorityHours'), { min: 0, max: 720 })}
      {field('points_multiplier', t('admin.fields.pointsMultiplier'), { min: 1, max: 10, step: '0.05' })}
    </div>
  );
}
