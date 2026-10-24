import type { GroupBookingPayload, GroupComboLine, GroupOrganizer } from '../types/groupBooking.types';

// Mirrors the server's checks (cinema-be/src/utils/groupBooking.js) so the form can point at a field
// before submitting; the server stays the authority.
const TAX_CODE_PATTERN = /^[0-9]{10}(-?[0-9]{3})?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9 .-]{6,20}$/;
export const MAX_COMBO_QUANTITY = 100;

export function emptyOrganizer(): GroupOrganizer {
  return {
    organizer_type: 'CUSTOMER',
    group_name: '',
    company_name: '',
    tax_code: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    note: '',
  };
}

/** Sets one combo's quantity (0 removes the line), clamped to what the server accepts. */
export function setComboQuantity(lines: GroupComboLine[], comboId: number, quantity: number): GroupComboLine[] {
  const clamped = Math.max(0, Math.min(MAX_COMBO_QUANTITY, Math.floor(Number(quantity) || 0)));
  const others = lines.filter((line) => line.combo_id !== comboId);
  if (clamped === 0) return others;
  const index = lines.findIndex((line) => line.combo_id === comboId);
  const next = { combo_id: comboId, quantity: clamped };
  if (index === -1) return [...others, next];
  return lines.map((line) => (line.combo_id === comboId ? next : line));
}

export function comboQuantity(lines: GroupComboLine[], comboId: number): number {
  return lines.find((line) => line.combo_id === comboId)?.quantity ?? 0;
}

export function toggleTicket(ticketIds: number[], ticketId: number): number[] {
  return ticketIds.includes(ticketId) ? ticketIds.filter((id) => id !== ticketId) : [...ticketIds, ticketId];
}

/** Field -> i18n key of the problem, for the fields the server would refuse. */
export function organizerErrors(organizer: GroupOrganizer): Partial<Record<keyof GroupOrganizer, string>> {
  const errors: Partial<Record<keyof GroupOrganizer, string>> = {};
  if (organizer.organizer_type === 'COMPANY') {
    if (!organizer.company_name.trim()) errors.company_name = 'organizer.errors.companyNameRequired';
    if (organizer.tax_code.trim() && !TAX_CODE_PATTERN.test(organizer.tax_code.trim())) {
      errors.tax_code = 'organizer.errors.taxCodeInvalid';
    }
  }
  if (organizer.contact_email.trim() && !EMAIL_PATTERN.test(organizer.contact_email.trim())) {
    errors.contact_email = 'organizer.errors.emailInvalid';
  }
  if (organizer.contact_phone.trim() && !PHONE_PATTERN.test(organizer.contact_phone.trim())) {
    errors.contact_phone = 'organizer.errors.phoneInvalid';
  }
  return errors;
}

/** The request body for both quote and checkout. Seats sorted so the same selection is the same order. */
export function buildGroupPayload({
  scheduleId,
  ticketIds,
  comboLines,
  organizer,
  promotionCode,
}: {
  scheduleId: number;
  ticketIds: number[];
  comboLines: GroupComboLine[];
  organizer: GroupOrganizer;
  promotionCode: string;
}): GroupBookingPayload {
  const payload: GroupBookingPayload = {
    schedule_id: scheduleId,
    ticket_ids: [...ticketIds].sort((a, b) => a - b),
    combos: comboLines.filter((line) => line.quantity > 0),
    organizer: {
      ...organizer,
      // A private group has no company to invoice.
      company_name: organizer.organizer_type === 'COMPANY' ? organizer.company_name : '',
      tax_code: organizer.organizer_type === 'COMPANY' ? organizer.tax_code : '',
    },
  };
  const code = promotionCode.trim().toUpperCase();
  if (code) payload.promotion_code = code;
  return payload;
}

/** What makes two checkouts "the same order" for the Idempotency-Key: seats, combos and the code. */
export function orderSignature(payload: GroupBookingPayload): string {
  return JSON.stringify([payload.schedule_id, payload.ticket_ids, payload.combos, payload.promotion_code ?? null]);
}
