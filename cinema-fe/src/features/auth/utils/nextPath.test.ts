import { describe, expect, it } from 'vitest';
import { loginPathReturningTo, safeNextPath } from './nextPath';

describe('safeNextPath', () => {
  it('keeps a path on this site, with its query and hash', () => {
    expect(safeNextPath('/InSeat?qr=SQR1.a.b')).toBe('/InSeat?qr=SQR1.a.b');
    expect(safeNextPath('/MyTickets#top')).toBe('/MyTickets#top');
  });

  it.each([
    ['an absolute URL', 'https://evil.example.com/'],
    ['a protocol-relative URL', '//evil.example.com/x'],
    ['a backslash trick', '/\\evil.example.com'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', 'InSeat'],
    ['nothing', null],
    ['an empty string', ''],
  ])('refuses %s', (_label, raw) => {
    expect(safeNextPath(raw)).toBeNull();
  });

  it('builds the login link that returns to a page', () => {
    const link = loginPathReturningTo('/InSeat?qr=SQR1.a.b');
    expect(link).toBe('/Login?next=%2FInSeat%3Fqr%3DSQR1.a.b');
    expect(safeNextPath(new URLSearchParams(link.split('?')[1]).get('next'))).toBe(
      '/InSeat?qr=SQR1.a.b',
    );
  });
});
