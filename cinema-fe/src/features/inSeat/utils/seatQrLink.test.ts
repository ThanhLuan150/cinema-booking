import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSeatQrUrl,
  extractSeatQr,
  inSeatPathFor,
  lastSeatQr,
  rememberSeatQr,
} from './seatQrLink';

const TOKEN = 'SQR1.eyJ2IjoxfQ.c2ln';

describe('seat QR links', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('reads the bare token or the URL a printed seat QR encodes', () => {
    expect(extractSeatQr(TOKEN)).toBe(TOKEN);
    expect(extractSeatQr(`  ${TOKEN} `)).toBe(TOKEN);
    expect(extractSeatQr(`https://cinema.example.com/InSeat?qr=${encodeURIComponent(TOKEN)}`)).toBe(
      TOKEN,
    );
  });

  it('rejects anything that is not a seat QR (a ticket QR, a random link, empty input)', () => {
    expect(extractSeatQr('TCK-1234')).toBeNull();
    expect(extractSeatQr('https://cinema.example.com/InSeat?qr=TCK-1234')).toBeNull();
    expect(extractSeatQr('https://example.com/')).toBeNull();
    expect(extractSeatQr('')).toBeNull();
    expect(extractSeatQr(null)).toBeNull();
  });

  it('builds the link a seat QR encodes, round-tripping the token', () => {
    const url = buildSeatQrUrl(TOKEN, 'https://cinema.example.com');
    expect(url).toBe(`https://cinema.example.com/InSeat?qr=${encodeURIComponent(TOKEN)}`);
    expect(extractSeatQr(url)).toBe(TOKEN);
    expect(inSeatPathFor(TOKEN)).toBe(`/InSeat?qr=${encodeURIComponent(TOKEN)}`);
  });

  it('remembers the last seat for "order more", and survives storage that throws', () => {
    rememberSeatQr(TOKEN);
    expect(lastSeatQr()).toBe(TOKEN);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => rememberSeatQr(TOKEN)).not.toThrow();
    expect(lastSeatQr()).toBeNull();
  });
});
