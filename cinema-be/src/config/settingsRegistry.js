const TYPE = { NUMBER: 'NUMBER', STRING: 'STRING', BOOLEAN: 'BOOLEAN', JSON: 'JSON' };

// A finite number, honoring min/max when the entry defines them. Returns an error message
// string, or null when valid.
function validateNumber(raw, entry) {
  const num = Number(raw);
  if (raw === null || raw === '' || Number.isNaN(num) || !Number.isFinite(num)) {
    return 'must be a finite number';
  }
  if (entry.min !== undefined && num < entry.min) return `must be >= ${entry.min}`;
  if (entry.max !== undefined && num > entry.max) return `must be <= ${entry.max}`;
  return null;
}

function validateString(raw, entry) {
  if (typeof raw !== 'string' || !raw.trim()) return 'must be a non-empty string';
  if (entry.allowedValues && !entry.allowedValues.includes(raw)) {
    return `must be one of: ${entry.allowedValues.join(', ')}`;
  }
  return null;
}

function validateBoolean(raw) {
  if (typeof raw !== 'boolean') return 'must be true or false';
  return null;
}

// REFUND_POLICY's shape: an ordered list of { minHours, percent } tiers.
function validateRefundPolicy(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return 'must be a non-empty array of tiers';
  for (const tier of raw) {
    if (!tier || typeof tier !== 'object') return 'each tier must be an object';
    const { minHours, percent } = tier;
    if (typeof minHours !== 'number' || !Number.isFinite(minHours) || minHours < 0) {
      return 'each tier.minHours must be a number >= 0';
    }
    if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      return 'each tier.percent must be a number between 0 and 100';
    }
  }
  return null;
}

const SETTINGS = {
  BOOKING_HOLD_TIME: {
    type: TYPE.NUMBER,
    module: 'booking',
    unit: 'minutes',
    label: 'Booking hold time',
    description: 'How long a held seat stays reserved for the customer before it is released automatically.',
    default: 5,
    min: 1,
    max: 60,
    branchOverridable: true,
  },
  CHECKIN_BEFORE_SHOWTIME: {
    type: TYPE.NUMBER,
    module: 'ticket',
    unit: 'minutes',
    label: 'Check-in window before showtime',
    description: 'How many minutes before showtime a ticket can start being checked in at the door.',
    default: 60,
    min: 0,
    max: 240,
    branchOverridable: true,
  },
  CANCELLATION_LIMIT: {
    type: TYPE.NUMBER,
    module: 'booking',
    unit: 'hours',
    label: 'Cancellation cutoff',
    description: 'Minimum hours before showtime a booking or ticket may still be cancelled.',
    default: 2,
    min: 0,
    max: 72,
    branchOverridable: true,
  },
  DEFAULT_CURRENCY: {
    type: TYPE.STRING,
    module: 'billing',
    unit: null,
    label: 'Default currency',
    description: 'Currency code used to display and process prices across the system.',
    default: 'VND',
    allowedValues: ['VND', 'USD'],
    branchOverridable: false,
  },
  TAX_RATE: {
    type: TYPE.NUMBER,
    module: 'billing',
    unit: 'percent',
    label: 'Tax rate',
    description: 'VAT/tax percentage applied on top of ticket and combo prices.',
    default: 0,
    min: 0,
    max: 100,
    branchOverridable: false,
  },
  MAX_BOOKING_SEATS: {
    type: TYPE.NUMBER,
    module: 'booking',
    unit: 'seats',
    label: 'Max seats per booking',
    description: 'Maximum number of seats a single customer may hold/book at once.',
    default: 8,
    min: 1,
    max: 50,
    branchOverridable: true,
  },
  REFUND_POLICY: {
    type: TYPE.JSON,
    module: 'refund',
    unit: null,
    label: 'Refund policy tiers',
    description: 'Refund percentage tiers, keyed by the minimum hours-before-showtime a cancellation still qualifies for.',
    default: [
      { minHours: 24, percent: 100 },
      { minHours: 2, percent: 50 },
    ],
    branchOverridable: true,
    validateValue: validateRefundPolicy,
  },
};

const KEYS = Object.keys(SETTINGS);

class SettingValidationError extends Error {
  constructor(details) {
    super('System configuration validation failed');
    this.name = 'SettingValidationError';
    this.status = 400;
    this.details = details;
  }
}

// Normalizes + validates a raw value against `key`'s entry. Returns the normalized value, or
// throws SettingValidationError with a per-field `details` array.
function validateValue(key, rawValue) {
  const entry = SETTINGS[key];
  if (!entry) {
    throw new SettingValidationError([{ field: 'key', message: `Unknown setting key: ${key}` }]);
  }

  let error = null;
  let value = rawValue;
  switch (entry.type) {
    case TYPE.NUMBER:
      error = validateNumber(rawValue, entry);
      value = error ? rawValue : Number(rawValue);
      break;
    case TYPE.STRING:
      error = validateString(rawValue, entry);
      break;
    case TYPE.BOOLEAN:
      error = validateBoolean(rawValue);
      break;
    case TYPE.JSON:
      error = entry.validateValue ? entry.validateValue(rawValue) : null;
      break;
    default:
      error = `unsupported type ${entry.type}`;
  }

  if (error) {
    throw new SettingValidationError([{ field: 'value', message: `${key} ${error}` }]);
  }
  return value;
}

// Metadata for the admin API / FE form — never includes any stored override, just the registry
// shape (type, default, unit, bounds, whether a branch may override it).
function meta(key) {
  const entry = SETTINGS[key];
  if (!entry) return null;
  return {
    key,
    module: entry.module,
    type: entry.type,
    unit: entry.unit ?? null,
    label: entry.label,
    description: entry.description,
    default: entry.default,
    min: entry.min ?? null,
    max: entry.max ?? null,
    allowedValues: entry.allowedValues ?? null,
    branchOverridable: Boolean(entry.branchOverridable),
  };
}

function listMeta() {
  return KEYS.map(meta);
}

module.exports = { TYPE, SETTINGS, KEYS, validateValue, meta, listMeta, SettingValidationError };
