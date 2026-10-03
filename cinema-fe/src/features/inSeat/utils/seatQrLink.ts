import { ROUTES } from '@/constants/routes';

const TOKEN_PREFIX = 'SQR1.';
const LAST_QR_STORAGE_KEY = 'inSeat.lastQr';

/**
 * The seat token out of whatever a scan produced: the bare token, or the URL a printed seat QR
 * encodes (…/InSeat?qr=<token>). Anything else is not a seat QR (e.g. a ticket's own QR).
 * Only the shape is checked here — the server verifies the signature.
 */
export function extractSeatQr(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  if (text.startsWith(TOKEN_PREFIX)) return text;
  try {
    const fromUrl = new URL(text).searchParams.get('qr');
    return fromUrl && fromUrl.trim().startsWith(TOKEN_PREFIX) ? fromUrl.trim() : null;
  } catch {
    return null;
  }
}

/** The link a seat QR encodes: scanning it with any phone camera opens the ordering page. */
export function buildSeatQrUrl(token: string, origin: string = window.location.origin): string {
  return `${origin}${ROUTES.inSeat}?qr=${encodeURIComponent(token)}`;
}

export function inSeatPathFor(token: string): string {
  return `${ROUTES.inSeat}?qr=${encodeURIComponent(token)}`;
}

// Remembered per tab, so the order-tracking page can offer "order more to this seat". Storage can
// throw (private mode, blocked site data) — the feature then simply falls back to the scanner.
export function rememberSeatQr(token: string): void {
  try {
    sessionStorage.setItem(LAST_QR_STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

export function lastSeatQr(): string | null {
  try {
    return extractSeatQr(sessionStorage.getItem(LAST_QR_STORAGE_KEY));
  } catch {
    return null;
  }
}
