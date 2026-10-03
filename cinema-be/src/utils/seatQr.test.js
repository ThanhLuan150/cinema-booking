const { signSeatQr, verifySeatQr, extractSeatQrToken, MAX_TOKEN_LENGTH } = require('./seatQr');

const SEAT = { branchId: 1, roomId: 5, scheduleId: 7, seatCode: 'e7' };

// Rebuilds a token with a different payload but the ORIGINAL signature — what a customer editing the
// QR (e.g. to another showtime) would produce.
function withPayload(token, changes) {
  const [prefix, body, signature] = token.split('.');
  const payload = { ...JSON.parse(Buffer.from(body, 'base64url').toString('utf8')), ...changes };
  return `${prefix}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${signature}`;
}

describe('seat QR tokens', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SEAT_QR_SECRET;
  });
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('round-trips Branch, Room, Showtime and Seat (seat code upper-cased)', () => {
    const token = signSeatQr(SEAT);
    expect(token.startsWith('SQR1.')).toBe(true);
    expect(verifySeatQr(token)).toEqual({
      payload: { branchId: 1, roomId: 5, scheduleId: 7, seatCode: 'E7' },
    });
  });

  it('is deterministic, so reprinting a sheet never invalidates the QR already on the seat', () => {
    expect(signSeatQr(SEAT)).toBe(signSeatQr({ ...SEAT, seatCode: 'E7' }));
    expect(signSeatQr(SEAT)).not.toBe(signSeatQr({ ...SEAT, scheduleId: 8 }));
  });

  it.each([
    ['showtime', { s: 8 }],
    ['room', { r: 6 }],
    ['branch', { b: 2 }],
    ['seat', { c: 'E8' }],
  ])('rejects a QR whose %s was edited (signature no longer matches)', (_field, changes) => {
    expect(verifySeatQr(withPayload(signSeatQr(SEAT), changes))).toEqual({ error: 'SEAT_QR_INVALID' });
  });

  it('rejects a QR signed with another secret', () => {
    process.env.SEAT_QR_SECRET = 'other-secret';
    const foreign = signSeatQr(SEAT);
    delete process.env.SEAT_QR_SECRET;
    expect(verifySeatQr(foreign)).toEqual({ error: 'SEAT_QR_INVALID' });
  });

  it('prefers SEAT_QR_SECRET over JWT_SECRET when both are set', () => {
    process.env.SEAT_QR_SECRET = 'seat-secret';
    const token = signSeatQr(SEAT);
    expect(verifySeatQr(token).payload).toBeTruthy();
    process.env.JWT_SECRET = 'rotated-jwt';
    expect(verifySeatQr(token).payload).toBeTruthy(); // unaffected by a JWT rotation
  });

  it.each([
    ['empty', ''],
    ['not a string', 42],
    ['a ticket QR', 'TCK-abcdef'],
    ['two parts', 'SQR1.abc'],
    ['wrong prefix', signSeatQr(SEAT).replace(/^SQR1/, 'SQR2')],
    ['truncated signature', signSeatQr(SEAT).slice(0, -4)],
    ['too long', `SQR1.${'a'.repeat(MAX_TOKEN_LENGTH)}.x`],
  ])('rejects garbage (%s)', (_label, raw) => {
    expect(verifySeatQr(raw)).toEqual({ error: 'SEAT_QR_INVALID' });
  });

  it('rejects a well-signed payload with an invalid shape', () => {
    // Signed with the real key, so only the shape check can stop it.
    const crypto = require('crypto');
    const body = `SQR1.${Buffer.from(JSON.stringify({ v: 1, b: 1, r: 5, s: -7, c: 'E7' })).toString('base64url')}`;
    const sig = crypto.createHmac('sha256', `${process.env.JWT_SECRET}:seat-qr`).update(body).digest('base64url');
    expect(verifySeatQr(`${body}.${sig}`)).toEqual({ error: 'SEAT_QR_INVALID' });
  });

  it('accepts the URL a phone camera opens as well as the bare token', () => {
    const token = signSeatQr(SEAT);
    const url = `https://cinema.example.com/InSeat?qr=${encodeURIComponent(token)}`;
    expect(extractSeatQrToken(url)).toBe(token);
    expect(verifySeatQr(url).payload.seatCode).toBe('E7');
    expect(extractSeatQrToken('https://cinema.example.com/InSeat')).toBeNull();
  });

  it('refuses to sign an incomplete seat', () => {
    expect(() => signSeatQr({ ...SEAT, scheduleId: 0 })).toThrow();
    expect(() => signSeatQr({ ...SEAT, seatCode: 'E 7' })).toThrow();
  });
});
