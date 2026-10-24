import { describe, expect, it } from 'vitest';
import {
  MAX_COMBO_QUANTITY,
  buildGroupPayload,
  comboQuantity,
  emptyOrganizer,
  orderSignature,
  organizerErrors,
  setComboQuantity,
  toggleTicket,
} from './groupOrder';

describe('setComboQuantity', () => {
  it('adds, updates and removes a line', () => {
    let lines = setComboQuantity([], 1, 5);
    expect(lines).toEqual([{ combo_id: 1, quantity: 5 }]);
    lines = setComboQuantity(lines, 2, 10);
    lines = setComboQuantity(lines, 1, 6);
    expect(lines).toEqual([
      { combo_id: 1, quantity: 6 },
      { combo_id: 2, quantity: 10 },
    ]);
    expect(setComboQuantity(lines, 1, 0)).toEqual([{ combo_id: 2, quantity: 10 }]);
  });

  it('clamps to whole numbers between 0 and the server maximum', () => {
    expect(setComboQuantity([], 1, MAX_COMBO_QUANTITY + 50)).toEqual([{ combo_id: 1, quantity: MAX_COMBO_QUANTITY }]);
    expect(setComboQuantity([], 1, 2.7)).toEqual([{ combo_id: 1, quantity: 2 }]);
    expect(setComboQuantity([{ combo_id: 1, quantity: 3 }], 1, -4)).toEqual([]);
    expect(comboQuantity([{ combo_id: 1, quantity: 3 }], 1)).toBe(3);
    expect(comboQuantity([], 1)).toBe(0);
  });
});

describe('toggleTicket', () => {
  it('selects and deselects a seat', () => {
    expect(toggleTicket([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleTicket([1, 2, 3], 2)).toEqual([1, 3]);
  });
});

describe('organizerErrors', () => {
  it('requires a company name and checks the tax code only for a company', () => {
    expect(organizerErrors({ ...emptyOrganizer(), organizer_type: 'COMPANY', tax_code: '12' })).toEqual({
      company_name: 'organizer.errors.companyNameRequired',
      tax_code: 'organizer.errors.taxCodeInvalid',
    });
    expect(organizerErrors({ ...emptyOrganizer(), organizer_type: 'COMPANY', company_name: 'Acme', tax_code: '0101234567-001' })).toEqual({});
    expect(organizerErrors({ ...emptyOrganizer(), tax_code: '12' })).toEqual({});
  });

  it('checks the contact email and phone when given', () => {
    expect(organizerErrors({ ...emptyOrganizer(), contact_email: 'nope', contact_phone: 'call me' })).toEqual({
      contact_email: 'organizer.errors.emailInvalid',
      contact_phone: 'organizer.errors.phoneInvalid',
    });
  });
});

describe('buildGroupPayload', () => {
  it('sorts the seats, drops empty combo lines and upper-cases the code — and never carries a price', () => {
    const payload = buildGroupPayload({
      scheduleId: 7,
      ticketIds: [3, 1, 2],
      comboLines: [
        { combo_id: 1, quantity: 5 },
        { combo_id: 2, quantity: 0 },
      ],
      organizer: { ...emptyOrganizer(), company_name: 'Acme', tax_code: '0101234567' },
      promotionCode: ' summer ',
    });
    expect(payload).toEqual({
      schedule_id: 7,
      ticket_ids: [1, 2, 3],
      combos: [{ combo_id: 1, quantity: 5 }],
      organizer: { ...emptyOrganizer(), company_name: '', tax_code: '' },
      promotion_code: 'SUMMER',
    });
    expect(Object.keys(payload).some((key) => /price|total|amount|discount/i.test(key))).toBe(false);
  });

  it('gives the same signature to the same order whatever order the seats were clicked in', () => {
    const base = { scheduleId: 7, comboLines: [], organizer: emptyOrganizer(), promotionCode: '' };
    const a = orderSignature(buildGroupPayload({ ...base, ticketIds: [2, 1] }));
    const b = orderSignature(buildGroupPayload({ ...base, ticketIds: [1, 2] }));
    const c = orderSignature(buildGroupPayload({ ...base, ticketIds: [1, 3] }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
