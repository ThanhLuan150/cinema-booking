const crypto = require('crypto');

const PREFIX = 'SQR1';
const MAX_TOKEN_LENGTH = 512;
const SEAT_CODE_PATTERN = /^[A-Z0-9-]{1,12}$/;

function signingKey() {
  const secret = process.env.SEAT_QR_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('SEAT_QR_SECRET (or JWT_SECRET) must be set to sign seat QR codes');
  return `${secret}:seat-qr`;
}

function sign(body) {
  return crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function normalizeSeatCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function signSeatQr({ branchId, roomId, scheduleId, seatCode }) {
  const payload = {
    v: 1,
    b: Number(branchId),
    r: Number(roomId),
    s: Number(scheduleId),
    c: normalizeSeatCode(seatCode),
  };
  if (![payload.b, payload.r, payload.s].every(isPositiveInt) || !SEAT_CODE_PATTERN.test(payload.c)) {
    throw new Error('A seat QR needs a branch, room, showtime and seat code');
  }
  const body = `${PREFIX}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  return `${body}.${sign(body)}`;
}

// The scanned text may be the bare token or the URL the QR encodes (…/InSeat?qr=<token>).
function extractSeatQrToken(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text || text.length > MAX_TOKEN_LENGTH * 4) return null;
  if (text.startsWith(`${PREFIX}.`)) return text;
  try {
    const fromUrl = new URL(text).searchParams.get('qr');
    return fromUrl ? fromUrl.trim() : null;
  } catch {
    return null;
  }
}

// -> { payload: { branchId, roomId, scheduleId, seatCode } } or { error: 'SEAT_QR_INVALID' }.
// Every failure is the same error on purpose: a forged, truncated or tampered token is simply
// "not a seat QR", and the caller learns nothing about which part was wrong.
function verifySeatQr(raw) {
  const invalid = { error: 'SEAT_QR_INVALID' };
  const token = extractSeatQrToken(raw);
  if (!token || token.length > MAX_TOKEN_LENGTH) return invalid;

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return invalid;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return invalid;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return invalid;
  }
  if (!payload || payload.v !== 1) return invalid;
  const { b, r, s, c } = payload;
  if (![b, r, s].every(isPositiveInt) || typeof c !== 'string' || !SEAT_CODE_PATTERN.test(c)) return invalid;
  return { payload: { branchId: b, roomId: r, scheduleId: s, seatCode: c } };
}

module.exports = { PREFIX, MAX_TOKEN_LENGTH, signSeatQr, verifySeatQr, extractSeatQrToken };

