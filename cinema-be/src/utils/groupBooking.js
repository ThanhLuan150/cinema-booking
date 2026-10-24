const ORGANIZER_TYPES = ['CUSTOMER', 'COMPANY'];
const MAX_COMBO_QUANTITY = 100;
const TEXT_LIMITS = {
  group_name: 120,
  company_name: 200,
  tax_code: 20,
  contact_name: 120,
  contact_phone: 20,
  contact_email: 200,
  note: 500,
};
// Prices are only ever computed by the server — a body that tries to set one is refused, not ignored.
const PRICE_FIELD_PATTERN = /price|total|amount|discount|cost|fee/i;
const TAX_CODE_PATTERN = /^[0-9]{10}(-?[0-9]{3})?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9 .-]{6,20}$/;

class GroupBookingError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.name = 'GroupBookingError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

const fail = (code, status, message, extra) => {
  throw new GroupBookingError(code, status, message, extra);
};

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

function parseTicketIds(raw) {
  if (!Array.isArray(raw) || raw.length === 0) fail('SEATS_REQUIRED', 400, 'ticket_ids must list at least one seat');
  const ids = raw.map(Number);
  if (!ids.every(isPositiveInt)) fail('INVALID_SEATS', 400, 'ticket_ids must be positive integer ids');
  const seen = new Set();
  const duplicates = [];
  for (const id of ids) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  if (duplicates.length > 0) {
    fail('DUPLICATE_SEATS', 400, 'The same seat is listed more than once', { ticketIds: [...new Set(duplicates)] });
  }
  return ids;
}

// [{ combo_id, quantity }] -> merged lines (same combo listed twice adds up), in first-seen order.
function parseComboLines(raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) fail('INVALID_COMBO_LINE', 400, 'combos must be a list of { combo_id, quantity }');
  const quantityById = new Map();
  for (const line of raw) {
    const comboId = Number(line?.combo_id);
    const quantity = Number(line?.quantity);
    if (!isPositiveInt(comboId) || !isPositiveInt(quantity)) {
      fail('INVALID_COMBO_LINE', 400, 'Each combo line needs a combo_id and a whole quantity of at least 1');
    }
    quantityById.set(comboId, (quantityById.get(comboId) || 0) + quantity);
  }
  const lines = [...quantityById].map(([combo_id, quantity]) => ({ combo_id, quantity }));
  const tooMany = lines.find((l) => l.quantity > MAX_COMBO_QUANTITY);
  if (tooMany) {
    fail('COMBO_QUANTITY_TOO_LARGE', 400, `At most ${MAX_COMBO_QUANTITY} of one combo per booking`, {
      comboId: tooMany.combo_id,
      maxQuantity: MAX_COMBO_QUANTITY,
    });
  }
  return lines;
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function parseOrganizer(raw = {}) {
  const organizerType = raw.organizer_type === undefined ? 'CUSTOMER' : raw.organizer_type;
  if (!ORGANIZER_TYPES.includes(organizerType)) {
    fail('INVALID_ORGANIZER_TYPE', 400, `organizer_type must be one of ${ORGANIZER_TYPES.join(', ')}`);
  }
  const organizer = { organizer_type: organizerType };
  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    const value = text(raw[field]);
    if (value.length > limit) fail('GROUP_FIELD_TOO_LONG', 400, `${field} must be at most ${limit} characters`, { field });
    organizer[field] = value;
  }
  if (organizerType === 'COMPANY') {
    if (!organizer.company_name) fail('COMPANY_NAME_REQUIRED', 400, 'A company booking needs the company name');
    if (organizer.tax_code && !TAX_CODE_PATTERN.test(organizer.tax_code)) {
      fail('INVALID_TAX_CODE', 400, 'tax_code must be 10 digits, or 10 digits and a 3-digit branch suffix');
    }
  } else {
    // A personal group has no company to invoice.
    organizer.company_name = '';
    organizer.tax_code = '';
  }
  if (organizer.contact_email && !EMAIL_PATTERN.test(organizer.contact_email)) {
    fail('INVALID_CONTACT_EMAIL', 400, 'contact_email is not a valid email address');
  }
  if (organizer.contact_phone && !PHONE_PATTERN.test(organizer.contact_phone)) {
    fail('INVALID_CONTACT_PHONE', 400, 'contact_phone is not a valid phone number');
  }
  return organizer;
}

const code = (value) => (typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null);

// The whole request body of POST /api/group-bookings and /quote.
function parseGroupBookingBody(body = {}) {
  const priceField = Object.keys(body || {}).find((key) => PRICE_FIELD_PATTERN.test(key));
  if (priceField) {
    fail('GROUP_PRICE_READONLY', 400, 'Prices are calculated by the server and cannot be sent', { field: priceField });
  }
  const scheduleId = Number(body.schedule_id);
  if (!isPositiveInt(scheduleId)) fail('SCHEDULE_REQUIRED', 400, 'schedule_id is required');

  const promotionCode = code(body.promotion_code);
  const voucherCode = code(body.voucher_code);
  if (promotionCode && voucherCode) {
    fail('DISCOUNT_CONFLICT', 400, 'Cannot apply both a voucher and a promotion to the same order');
  }

  return {
    scheduleId,
    ticketIds: parseTicketIds(body.ticket_ids),
    comboLines: parseComboLines(body.combos),
    organizer: parseOrganizer(body.organizer || {}),
    promotionCode,
    voucherCode,
  };
}

// "All seats belong to the same showtime": the ids of the tickets that are not on `scheduleId`.
function ticketsOutsideShowtime(tickets, scheduleId) {
  return tickets.filter((t) => Number(t.schedule_id) !== Number(scheduleId)).map((t) => t.id);
}

// [{ combo_id, quantity }] -> [id, id, ...] with each id repeated `quantity` times: the shape the rest
// of the booking pipeline (pricing, stock, the linked ComboOrder) already treats as a quantity.
function expandComboLines(lines) {
  return lines.flatMap(({ combo_id, quantity }) => Array.from({ length: quantity }, () => combo_id));
}

// The configured size limits, made consistent even if an admin set min above max.
function seatLimits(minSeats, maxSeats) {
  const max = Math.max(2, Number(maxSeats) || 2);
  const min = Math.min(Math.max(2, Number(minSeats) || 2), max);
  return { minSeats: min, maxSeats: max };
}

function assertSeatCount(count, { minSeats, maxSeats }) {
  if (count < minSeats) {
    fail('GROUP_TOO_SMALL', 400, `A group booking needs at least ${minSeats} seats`, { minSeats, maxSeats });
  }
  if (count > maxSeats) {
    fail('GROUP_TOO_LARGE', 400, `A group booking can reserve at most ${maxSeats} seats`, { minSeats, maxSeats });
  }
}

module.exports = {
  GroupBookingError,
  fail,
  MAX_COMBO_QUANTITY,
  parseGroupBookingBody,
  ticketsOutsideShowtime,
  expandComboLines,
  seatLimits,
  assertSeatCount,
};
