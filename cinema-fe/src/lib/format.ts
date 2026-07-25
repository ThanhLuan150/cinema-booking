import i18n from '@/i18n';

const CURRENCY_LOCALE: Record<string, string> = {
  vi: 'vi-VN',
  en: 'en-US',
};

function resolveLocale(lang?: string): string {
  const lng = (lang ?? i18n.resolvedLanguage ?? i18n.language ?? 'vi').slice(0, 2);
  return CURRENCY_LOCALE[lng] ?? CURRENCY_LOCALE.vi;
}

export function formatCurrency(value: number, lang?: string): string {
  return new Intl.NumberFormat(resolveLocale(lang), {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: string | number | Date, lang?: string): string {
  return new Intl.DateTimeFormat(resolveLocale(lang), { dateStyle: 'medium' }).format(new Date(date));
}
