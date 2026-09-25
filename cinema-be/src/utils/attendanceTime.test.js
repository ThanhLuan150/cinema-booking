const {
  DEFAULT_TIMEZONE,
  normalizeTimeZone,
  isValidTimeZone,
  sameTimeZone,
  isValidDateString,
  workDateFor,
  parseOffsetTimestamp,
} = require('./attendanceTime');

describe('attendanceTime', () => {
  describe('normalizeTimeZone / isValidTimeZone', () => {
    it('accepts real IANA names and keeps the spelling it was given', () => {
      // Not the ICU alias: Node 20 resolves Asia/Ho_Chi_Minh to Asia/Saigon.
      expect(normalizeTimeZone('Asia/Ho_Chi_Minh')).toBe('Asia/Ho_Chi_Minh');
      expect(normalizeTimeZone('  America/New_York ')).toBe('America/New_York');
      expect(normalizeTimeZone('America/Argentina/Buenos_Aires')).toBe('America/Argentina/Buenos_Aires');
      expect(normalizeTimeZone('UTC')).toBe('UTC');
    });

    it.each([
      ['a made-up region', 'Mars/Olympus_Mons'],
      ['a fixed offset', '+07:00'],
      ['an abbreviation', 'ICT'],
      ['an empty string', ''],
      ['whitespace', '   '],
      ['a number', 7],
      ['null', null],
      ['undefined', undefined],
      ['an object', {}],
      ['a name with injected characters', 'Asia/Ho_Chi_Minh; DROP'],
    ])('rejects %s', (_label, value) => {
      expect(normalizeTimeZone(value)).toBeNull();
      expect(isValidTimeZone(value)).toBe(false);
    });

    it('has a default that is itself valid', () => {
      expect(isValidTimeZone(DEFAULT_TIMEZONE)).toBe(true);
    });
  });

  describe('sameTimeZone', () => {
    it('ignores case and alias spelling', () => {
      expect(sameTimeZone('Asia/Ho_Chi_Minh', 'asia/ho_chi_minh')).toBe(true);
      expect(sameTimeZone('Asia/Ho_Chi_Minh', 'Asia/Saigon')).toBe(true);
      expect(sameTimeZone(' UTC ', 'UTC')).toBe(true);
    });

    it('tells different zones apart and never matches an invalid one', () => {
      expect(sameTimeZone('Asia/Ho_Chi_Minh', 'Asia/Bangkok')).toBe(false); // same offset, different zone
      expect(sameTimeZone('Nope/Nowhere', 'Nope/Nowhere')).toBe(false);
      expect(sameTimeZone(undefined, 'UTC')).toBe(false);
    });
  });

  describe('isValidDateString', () => {
    it('accepts real calendar days, including a leap day', () => {
      expect(isValidDateString('2026-09-26')).toBe(true);
      expect(isValidDateString('2028-02-29')).toBe(true);
    });

    it.each(['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-9-26', '26-09-2026', '', null, undefined, 20260926])(
      'rejects %p',
      (value) => {
        expect(isValidDateString(value)).toBe(false);
      },
    );
  });

  describe('workDateFor', () => {
    // One instant, several different work days depending on where the branch is.
    const instant = new Date('2026-09-26T18:30:00Z');

    it('cuts the day in the given zone, not in UTC or the host zone', () => {
      expect(workDateFor(instant, 'UTC')).toBe('2026-09-26');
      expect(workDateFor(instant, 'Asia/Ho_Chi_Minh')).toBe('2026-09-27'); // 01:30 next day
      expect(workDateFor(instant, 'Asia/Kolkata')).toBe('2026-09-27'); // 00:00 next day exactly
      expect(workDateFor(instant, 'Pacific/Pago_Pago')).toBe('2026-09-26'); // 07:30
      expect(workDateFor(instant, 'Pacific/Kiritimati')).toBe('2026-09-27'); // UTC+14
    });

    it('flips exactly at local midnight', () => {
      expect(workDateFor(new Date('2026-09-26T16:59:59Z'), 'Asia/Ho_Chi_Minh')).toBe('2026-09-26');
      expect(workDateFor(new Date('2026-09-26T17:00:00Z'), 'Asia/Ho_Chi_Minh')).toBe('2026-09-27');
    });

    it('follows daylight-saving changes', () => {
      expect(workDateFor(new Date('2026-03-08T04:59:00Z'), 'America/New_York')).toBe('2026-03-07'); // 23:59 EST
      expect(workDateFor(new Date('2026-03-08T05:00:00Z'), 'America/New_York')).toBe('2026-03-08'); // 00:00 EST
      expect(workDateFor(new Date('2026-07-01T03:59:00Z'), 'America/New_York')).toBe('2026-06-30'); // 23:59 EDT
      expect(workDateFor(new Date('2026-07-01T04:00:00Z'), 'America/New_York')).toBe('2026-07-01'); // 00:00 EDT
    });

    it('accepts a canonicalisable zone name and an ISO string instant', () => {
      expect(workDateFor('2026-09-26T18:30:00Z', 'asia/ho_chi_minh')).toBe('2026-09-27');
    });

    it('throws for an invalid zone or instant instead of guessing', () => {
      expect(() => workDateFor(instant, 'Nope/Nowhere')).toThrow('Invalid timezone');
      expect(() => workDateFor('not a date', 'UTC')).toThrow('Invalid instant');
    });
  });

  describe('parseOffsetTimestamp', () => {
    it('parses timestamps that carry their own offset', () => {
      expect(parseOffsetTimestamp('2026-09-26T08:00:00Z').toISOString()).toBe('2026-09-26T08:00:00.000Z');
      expect(parseOffsetTimestamp('2026-09-26T08:00:00+07:00').toISOString()).toBe('2026-09-26T01:00:00.000Z');
      expect(parseOffsetTimestamp('2026-09-26T08:00:00-0500').toISOString()).toBe('2026-09-26T13:00:00.000Z');
      expect(parseOffsetTimestamp('2026-09-26T08:00Z').toISOString()).toBe('2026-09-26T08:00:00.000Z');
      expect(parseOffsetTimestamp('2026-09-26T08:00:00.250Z').toISOString()).toBe('2026-09-26T08:00:00.250Z');
    });

    it.each([
      ['a bare local time', '2026-09-26T08:00:00'],
      ['a date only', '2026-09-26'],
      ['a non-ISO string', 'Sat Sep 26 2026 08:00:00'],
      ['an impossible date', '2026-13-45T08:00:00Z'],
      ['a number', 1790000000000],
      ['null', null],
    ])('rejects %s', (_label, value) => {
      expect(parseOffsetTimestamp(value)).toBeNull();
    });
  });
});
