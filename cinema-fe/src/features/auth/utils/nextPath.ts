const PLACEHOLDER_ORIGIN = 'http://next.invalid';

/**
 * The `?next=` path to return to after logging in — only ever a path on this site. Absolute URLs,
 * protocol-relative `//host` and backslash tricks are refused, so the login page can never be used to
 * bounce someone to another origin.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  try {
    const url = new URL(raw, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** `/Login?next=<path>` for the page the visitor is on now. */
export function loginPathReturningTo(path: string): string {
  return `/Login?next=${encodeURIComponent(path)}`;
}
