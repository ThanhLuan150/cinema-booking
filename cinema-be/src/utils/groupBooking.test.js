const {
  GroupBookingError,
  MAX_COMBO_QUANTITY,
  parseGroupBookingBody,
  ticketsOutsideShowtime,
  expandComboLines,
  seatLimits,
  assertSeatCount,
} = require('./groupBooking');

const valid = (overrides = {}) => ({
  schedule_id: 7,
  ticket_ids: [1, 2, 3],
  combos: [{ combo_id: 1, quantity: 2 }],
  organizer: { organizer_type: 'CUSTOMER', group_name: '  Book club ' },
  ...overrides,
});

function refusal(fn) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(GroupBookingError);
    return { code: err.code, status: err.status, ...err.extra };
  }
  throw new Error('expected a GroupBookingError');
}

describe('parseGroupBookingBody', () => {
  it('normalizes a valid request', () => {
    expect(parseGroupBookingBody(valid({ promotion_code: ' group10 ' }))).toEqual({
      scheduleId: 7,
      ticketIds: [1, 2, 3],
      comboLines: [{ combo_id: 1, quantity: 2 }],
      organizer: {
        organizer_type: 'CUSTOMER',
        group_name: 'Book club',
        company_name: '',
        tax_code: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        note: '',
      },
      promotionCode: 'GROUP10',
      voucherCode: null,
    });
  });

  it('defaults the organizer to the customer themselves', () => {
    expect(parseGroupBookingBody(valid({ organizer: undefined })).organizer.organizer_type).toBe('CUSTOMER');
  });

  it('merges repeated combo lines into one quantity', () => {
    const { comboLines } = parseGroupBookingBody(
      valid({
        combos: [
          { combo_id: 2, quantity: 3 },
          { combo_id: 1, quantity: 1 },
          { combo_id: 2, quantity: 4 },
        ],
      }),
    );
    expect(comboLines).toEqual([
      { combo_id: 2, quantity: 7 },
      { combo_id: 1, quantity: 1 },
    ]);
  });

  it.each([
    [{ ticket_ids: [] }, 'SEATS_REQUIRED'],
    [{ ticket_ids: 'A1,A2' }, 'SEATS_REQUIRED'],
    [{ ticket_ids: [1, 'x'] }, 'INVALID_SEATS'],
    [{ ticket_ids: [1, 1.5] }, 'INVALID_SEATS'],
    [{ schedule_id: 'abc' }, 'SCHEDULE_REQUIRED'],
    [{ combos: [{ combo_id: 1 }] }, 'INVALID_COMBO_LINE'],
    [{ combos: [{ combo_id: 1, quantity: -1 }] }, 'INVALID_COMBO_LINE'],
    [{ combos: { combo_id: 1, quantity: 1 } }, 'INVALID_COMBO_LINE'],
    [{ organizer: { organizer_type: 'SCHOOL' } }, 'INVALID_ORGANIZER_TYPE'],
    [{ organizer: { organizer_type: 'COMPANY', company_name: '  ' } }, 'COMPANY_NAME_REQUIRED'],
    [{ organizer: { organizer_type: 'COMPANY', company_name: 'Acme', tax_code: '123' } }, 'INVALID_TAX_CODE'],
    [{ organizer: { contact_email: 'not-an-email' } }, 'INVALID_CONTACT_EMAIL'],
    [{ organizer: { contact_phone: 'call me' } }, 'INVALID_CONTACT_PHONE'],
    [{ organizer: { note: 'x'.repeat(501) } }, 'GROUP_FIELD_TOO_LONG'],
    [{ voucher_code: 'V1', promotion_code: 'P1' }, 'DISCOUNT_CONFLICT'],
  ])('refuses %j with %s', (overrides, code) => {
    expect(refusal(() => parseGroupBookingBody(valid(overrides))).code).toBe(code);
  });

  it('names the duplicated seats', () => {
    expect(refusal(() => parseGroupBookingBody(valid({ ticket_ids: [4, 5, 4, 6, 5] })))).toEqual({
      code: 'DUPLICATE_SEATS',
      status: 400,
      ticketIds: [4, 5],
    });
  });

  it('caps one combo line', () => {
    expect(refusal(() => parseGroupBookingBody(valid({ combos: [{ combo_id: 9, quantity: MAX_COMBO_QUANTITY + 1 }] })))).toMatchObject({
      code: 'COMBO_QUANTITY_TOO_LARGE',
      comboId: 9,
    });
  });

  it.each(['total_price', 'discount_amount', 'seatPrice', 'amount', 'fee'])('refuses a client-sent %s', (field) => {
    expect(refusal(() => parseGroupBookingBody(valid({ [field]: 1 })))).toMatchObject({ code: 'GROUP_PRICE_READONLY', field });
  });

  it('accepts a company with a 10- or 13-digit tax code, and drops company fields for a private group', () => {
    const company = parseGroupBookingBody(
      valid({ organizer: { organizer_type: 'COMPANY', company_name: 'Acme', tax_code: '0101234567-001' } }),
    );
    expect(company.organizer).toMatchObject({ company_name: 'Acme', tax_code: '0101234567-001' });

    const personal = parseGroupBookingBody(valid({ organizer: { organizer_type: 'CUSTOMER', company_name: 'Acme', tax_code: 'x' } }));
    expect(personal.organizer).toMatchObject({ company_name: '', tax_code: '' });
  });
});

describe('ticketsOutsideShowtime', () => {
  it('lists the tickets that are not on the given showtime', () => {
    const tickets = [
      { id: 1, schedule_id: 7 },
      { id: 2, schedule_id: 8 },
      { id: 3, schedule_id: 7 },
      { id: 4, schedule_id: '8' },
    ];
    expect(ticketsOutsideShowtime(tickets, 7)).toEqual([2, 4]);
    expect(ticketsOutsideShowtime(tickets.filter((t) => t.id !== 2 && t.id !== 4), '7')).toEqual([]);
  });
});

describe('expandComboLines', () => {
  it('repeats each combo id by its quantity', () => {
    expect(
      expandComboLines([
        { combo_id: 1, quantity: 2 },
        { combo_id: 5, quantity: 1 },
      ]),
    ).toEqual([1, 1, 5]);
    expect(expandComboLines([])).toEqual([]);
  });
});

describe('seat limits', () => {
  it('keeps min <= max and never below a group of 2', () => {
    expect(seatLimits(2, 50)).toEqual({ minSeats: 2, maxSeats: 50 });
    expect(seatLimits(20, 10)).toEqual({ minSeats: 10, maxSeats: 10 });
    expect(seatLimits(undefined, undefined)).toEqual({ minSeats: 2, maxSeats: 2 });
  });

  it('refuses a count outside the limits with both numbers', () => {
    const limits = { minSeats: 3, maxSeats: 5 };
    expect(refusal(() => assertSeatCount(2, limits))).toEqual({ code: 'GROUP_TOO_SMALL', status: 400, minSeats: 3, maxSeats: 5 });
    expect(refusal(() => assertSeatCount(6, limits))).toEqual({ code: 'GROUP_TOO_LARGE', status: 400, minSeats: 3, maxSeats: 5 });
    expect(() => assertSeatCount(3, limits)).not.toThrow();
    expect(() => assertSeatCount(5, limits)).not.toThrow();
  });
});
