const ComboOrder = require('../models/ComboOrder');

// Kitchen Display System vocabulary. The KDS speaks its own five statuses, but they are a VIEW of the
// ComboOrder's real status, never stored separately: the counter's /combo-orders flow and the kitchen
// screen read and write the same field, so the two can never disagree about where an order is.
const KDS_STATUS = {
  NEW: 'NEW',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};
const KDS_STATUSES = Object.values(KDS_STATUS);
const ACTIVE_KDS_STATUSES = [KDS_STATUS.NEW, KDS_STATUS.PREPARING, KDS_STATUS.READY];
const DONE_KDS_STATUSES = [KDS_STATUS.COMPLETED, KDS_STATUS.CANCELLED];

// KDS status <-> ComboOrder.status. PENDING has no KDS status on purpose: an unpaid order is not on
// the kitchen screen at all.
const KDS_TO_ORDER_STATUS = {
  [KDS_STATUS.NEW]: ComboOrder.STATUS.PAID,
  [KDS_STATUS.PREPARING]: ComboOrder.STATUS.PREPARING,
  [KDS_STATUS.READY]: ComboOrder.STATUS.READY,
  [KDS_STATUS.COMPLETED]: ComboOrder.STATUS.DELIVERED,
  [KDS_STATUS.CANCELLED]: ComboOrder.STATUS.CANCELLED,
};
const ORDER_TO_KDS_STATUS = Object.fromEntries(
  Object.entries(KDS_TO_ORDER_STATUS).map(([kds, order]) => [order, kds]),
);

// The order field stamped, in the same atomic update as the status change, when an order enters each
// KDS status. NEW is the moment payment cleared — when the order arrived in the kitchen.
const KDS_TIMESTAMP_FIELD = {
  [KDS_STATUS.NEW]: 'paid_at',
  [KDS_STATUS.PREPARING]: 'prepared_at',
  [KDS_STATUS.READY]: 'ready_at',
  [KDS_STATUS.COMPLETED]: 'delivered_at',
  [KDS_STATUS.CANCELLED]: 'cancelled_at',
};

// Forward-only. READY cannot be cancelled (the food is made — same rule as
// ComboOrder.CANCELLABLE_STATUSES) and nothing ever moves back to NEW.
const KDS_TRANSITIONS = {
  [KDS_STATUS.NEW]: [KDS_STATUS.PREPARING, KDS_STATUS.CANCELLED],
  [KDS_STATUS.PREPARING]: [KDS_STATUS.READY, KDS_STATUS.CANCELLED],
  [KDS_STATUS.READY]: [KDS_STATUS.COMPLETED],
  [KDS_STATUS.COMPLETED]: [],
  [KDS_STATUS.CANCELLED]: [],
};

// The ONLY fields a KDS status update may carry. Everything else is refused rather than ignored, so a
// client that tries to change a price (or anything else) learns it cannot, instead of silently
// believing it did.
const ALLOWED_UPDATE_FIELDS = ['status', 'reason'];
const PRICE_FIELD_PATTERN = /price|total|amount|discount|cost|fee|^items$/i;
const MAX_REASON_LENGTH = 300;

// An order is on the KDS only once it has been paid. `paid_at` is the proof: an order cancelled while
// still PENDING has paid_at null and never appears, whereas one cancelled after payment shows as
// CANCELLED so the kitchen knows to stop.
function toKdsStatus(order) {
  if (!order || !order.paid_at) return null;
  return ORDER_TO_KDS_STATUS[order.status] ?? null;
}

function canTransition(from, to) {
  return (KDS_TRANSITIONS[from] || []).includes(to);
}

function kdsTimestamps(order) {
  return Object.fromEntries(
    KDS_STATUSES.map((status) => [status, order[KDS_TIMESTAMP_FIELD[status]] ?? null]),
  );
}

// `?status=NEW,PREPARING` -> ['NEW', 'PREPARING']; empty -> null (the caller's default).
function parseKdsStatuses(raw) {
  if (raw === undefined || raw === null || raw === '') return { statuses: null };
  const list = (Array.isArray(raw) ? raw : String(raw).split(','))
    .map((value) => String(value).trim().toUpperCase())
    .filter(Boolean);
  const invalid = list.filter((value) => !KDS_STATUSES.includes(value));
  if (invalid.length > 0) return { error: { code: 'INVALID_KDS_STATUS', invalid } };
  return { statuses: [...new Set(list)] };
}

// Validates a PATCH body: { status, reason? }. reason is required (and only used) for CANCELLED.
function validateStatusUpdate(body) {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const extra = Object.keys(payload).filter((key) => !ALLOWED_UPDATE_FIELDS.includes(key));
  if (extra.length > 0) {
    const priceFields = extra.filter((key) => PRICE_FIELD_PATTERN.test(key));
    return {
      error:
        priceFields.length > 0
          ? {
              code: 'KDS_PRICE_READONLY',
              message: 'Prices cannot be changed from the Kitchen Display',
              fields: priceFields,
            }
          : {
              code: 'KDS_FIELD_NOT_ALLOWED',
              message: `Only ${ALLOWED_UPDATE_FIELDS.join(', ')} may be sent`,
              fields: extra,
            },
    };
  }

  const status = typeof payload.status === 'string' ? payload.status.trim().toUpperCase() : '';
  if (!KDS_STATUSES.includes(status) || status === KDS_STATUS.NEW) {
    return {
      error: {
        code: 'INVALID_KDS_STATUS',
        message: `status must be one of ${KDS_STATUSES.filter((s) => s !== KDS_STATUS.NEW).join(', ')}`,
      },
    };
  }

  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (status === KDS_STATUS.CANCELLED) {
    if (!reason)
      return {
        error: {
          code: 'KDS_CANCEL_REASON_REQUIRED',
          message: 'A reason is required to cancel an order',
        },
      };
    if (reason.length > MAX_REASON_LENGTH) {
      return {
        error: {
          code: 'VALIDATION_ERROR',
          message: `reason must be at most ${MAX_REASON_LENGTH} characters`,
        },
      };
    }
  }
  return { status, reason: status === KDS_STATUS.CANCELLED ? reason : null };
}

module.exports = {
  KDS_STATUS,
  KDS_STATUSES,
  ACTIVE_KDS_STATUSES,
  DONE_KDS_STATUSES,
  KDS_TO_ORDER_STATUS,
  ORDER_TO_KDS_STATUS,
  KDS_TIMESTAMP_FIELD,
  KDS_TRANSITIONS,
  ALLOWED_UPDATE_FIELDS,
  MAX_REASON_LENGTH,
  toKdsStatus,
  canTransition,
  kdsTimestamps,
  parseKdsStatuses,
  validateStatusUpdate,
};
