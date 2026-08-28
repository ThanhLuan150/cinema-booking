import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './apiError';

function makeT(known: Record<string, string>) {
  return ((key: string, opts?: { defaultValue?: string }) => {
    if (key in known) return known[key];
    return opts?.defaultValue ?? key;
  }) as any;
}

describe('getApiErrorMessage', () => {
  it('returns the translated message for a known error code', () => {
    const t = makeT({ 'errors:EMAIL_TAKEN': 'This email is already registered' });
    const error = { response: { data: { code: 'EMAIL_TAKEN' } } };
    expect(getApiErrorMessage(error, t)).toBe('This email is already registered');
  });

  it('falls back to the raw message when the code has no translation', () => {
    const t = makeT({});
    const error = { response: { data: { code: 'UNKNOWN_CODE', message: 'Something broke' } } };
    expect(getApiErrorMessage(error, t)).toBe('Something broke');
  });

  it('falls back to the raw message when there is no code', () => {
    const t = makeT({});
    const error = { response: { data: { message: 'Server exploded' } } };
    expect(getApiErrorMessage(error, t)).toBe('Server exploded');
  });

  it('falls back to the generic translated error when there is no code or message', () => {
    const t = makeT({ 'errors:GENERIC': 'Something went wrong' });
    const error = { response: { data: {} } };
    expect(getApiErrorMessage(error, t)).toBe('Something went wrong');
  });

  it('handles an error with no response payload at all', () => {
    const t = makeT({ 'errors:GENERIC': 'Something went wrong' });
    expect(getApiErrorMessage(new Error('network fail'), t)).toBe('Something went wrong');
  });

  // Ticket 27: CANCEL_WINDOW_EXPIRED's copy interpolates {{hours}} from the backend's response
  // (the configured CANCELLATION_LIMIT) instead of hardcoding "2 hours" — verify the payload's
  // extra fields actually reach i18next's interpolation, not just the `code` lookup.
  it('passes the full error payload through as interpolation values for the translated message', () => {
    const t = ((key: string, opts?: Record<string, unknown>) => {
      if (key === 'errors:CANCEL_WINDOW_EXPIRED') {
        return `Tickets can only be cancelled at least ${opts?.hours} hour(s) before showtime`;
      }
      return '';
    }) as any;
    const error = { response: { data: { code: 'CANCEL_WINDOW_EXPIRED', hours: 4 } } };
    expect(getApiErrorMessage(error, t)).toBe('Tickets can only be cancelled at least 4 hour(s) before showtime');
  });
});
