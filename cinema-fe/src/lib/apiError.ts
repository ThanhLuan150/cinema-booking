import type { TFunction } from 'i18next';

interface ApiErrorPayload {
  code?: string;
  message?: string;
  [key: string]: unknown;
}

interface ErrorLike {
  response?: {
    data?: ApiErrorPayload;
  };
}

/**
 * Translates a backend error response via its `code` (errors.json), falling back to
 * the raw `message` the API sent, then to a generic translated fallback.
 */
export function getApiErrorMessage(error: unknown, t: TFunction): string {
  const data = (error as ErrorLike)?.response?.data;
  if (data?.code) {
    const key = `errors:${data.code}`;
    if (t(key, { defaultValue: '', ...data }) !== '') {
      return t(key, data);
    }
  }
  return data?.message || t('errors:GENERIC');
}
