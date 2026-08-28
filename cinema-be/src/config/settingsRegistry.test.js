const registry = require('./settingsRegistry');

describe('settingsRegistry', () => {
  it('exposes the 7 business settings from the ticket', () => {
    expect(registry.KEYS.sort()).toEqual(
      [
        'BOOKING_HOLD_TIME',
        'CHECKIN_BEFORE_SHOWTIME',
        'CANCELLATION_LIMIT',
        'DEFAULT_CURRENCY',
        'TAX_RATE',
        'MAX_BOOKING_SEATS',
        'REFUND_POLICY',
      ].sort(),
    );
  });

  it('meta() returns null for an unknown key', () => {
    expect(registry.meta('NOT_A_KEY')).toBeNull();
  });

  it('listMeta() returns one entry per key with no branchOverridable leaking undefined', () => {
    const list = registry.listMeta();
    expect(list).toHaveLength(registry.KEYS.length);
    for (const entry of list) {
      expect(typeof entry.branchOverridable).toBe('boolean');
    }
  });

  describe('validateValue — NUMBER', () => {
    it('accepts a value inside the range and coerces strings to numbers', () => {
      expect(registry.validateValue('BOOKING_HOLD_TIME', '10')).toBe(10);
    });

    it('rejects a value below min', () => {
      expect(() => registry.validateValue('BOOKING_HOLD_TIME', 0)).toThrow(registry.SettingValidationError);
    });

    it('rejects a value above max', () => {
      expect(() => registry.validateValue('BOOKING_HOLD_TIME', 999)).toThrow(registry.SettingValidationError);
    });

    it('rejects a non-numeric value', () => {
      try {
        registry.validateValue('CANCELLATION_LIMIT', 'soon');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(registry.SettingValidationError);
        expect(err.details[0].field).toBe('value');
      }
    });
  });

  describe('validateValue — STRING (enum)', () => {
    it('accepts an allowed value', () => {
      expect(registry.validateValue('DEFAULT_CURRENCY', 'USD')).toBe('USD');
    });

    it('rejects a value outside allowedValues', () => {
      expect(() => registry.validateValue('DEFAULT_CURRENCY', 'EUR')).toThrow(registry.SettingValidationError);
    });

    it('rejects an empty string', () => {
      expect(() => registry.validateValue('DEFAULT_CURRENCY', '')).toThrow(registry.SettingValidationError);
    });
  });

  describe('validateValue — JSON (REFUND_POLICY)', () => {
    it('accepts a well-shaped tier list', () => {
      const tiers = [
        { minHours: 24, percent: 100 },
        { minHours: 2, percent: 50 },
      ];
      expect(registry.validateValue('REFUND_POLICY', tiers)).toEqual(tiers);
    });

    it('rejects a non-array', () => {
      expect(() => registry.validateValue('REFUND_POLICY', { minHours: 1, percent: 1 })).toThrow(
        registry.SettingValidationError,
      );
    });

    it('rejects an empty array', () => {
      expect(() => registry.validateValue('REFUND_POLICY', [])).toThrow(registry.SettingValidationError);
    });

    it('rejects a tier with an out-of-range percent', () => {
      expect(() => registry.validateValue('REFUND_POLICY', [{ minHours: 1, percent: 150 }])).toThrow(
        registry.SettingValidationError,
      );
    });

    it('rejects a tier with a negative minHours', () => {
      expect(() => registry.validateValue('REFUND_POLICY', [{ minHours: -1, percent: 10 }])).toThrow(
        registry.SettingValidationError,
      );
    });
  });

  it('validateValue throws for an unknown key', () => {
    expect(() => registry.validateValue('NOT_A_KEY', 1)).toThrow(registry.SettingValidationError);
  });
});
