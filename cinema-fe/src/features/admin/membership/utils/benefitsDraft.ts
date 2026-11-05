import type { MembershipBenefits } from '@/features/membership/types/membership.types';

export type BenefitsDraft = Record<keyof MembershipBenefits, string>;

export const EMPTY_BENEFITS: MembershipBenefits = {
  ticket_discount_percent: 0,
  fnb_discount_percent: 0,
  free_tickets: 0,
  free_ticket_max_value: null,
  priority_booking_hours: 0,
  points_multiplier: 1,
};

export function toBenefitsDraft(benefits: Partial<MembershipBenefits> | undefined): BenefitsDraft {
  const b = { ...EMPTY_BENEFITS, ...(benefits ?? {}) };
  return {
    ticket_discount_percent: String(b.ticket_discount_percent),
    fnb_discount_percent: String(b.fnb_discount_percent),
    free_tickets: String(b.free_tickets),
    free_ticket_max_value: b.free_ticket_max_value == null ? '' : String(b.free_ticket_max_value),
    priority_booking_hours: String(b.priority_booking_hours),
    points_multiplier: String(b.points_multiplier),
  };
}

// The server validates every value; an empty number field is sent as its default (the cap: none).
export function fromBenefitsDraft(draft: BenefitsDraft): MembershipBenefits {
  const num = (value: string, fallback: number) => (value.trim() === '' ? fallback : Number(value));
  return {
    ticket_discount_percent: num(draft.ticket_discount_percent, 0),
    fnb_discount_percent: num(draft.fnb_discount_percent, 0),
    free_tickets: num(draft.free_tickets, 0),
    free_ticket_max_value: draft.free_ticket_max_value.trim() === '' ? null : Number(draft.free_ticket_max_value),
    priority_booking_hours: num(draft.priority_booking_hours, 0),
    points_multiplier: num(draft.points_multiplier, 1),
  };
}
