import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/Select';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

export interface LanguageSwitcherProps {
  className?: string;
}

const NATIVE_NAMES: Record<SupportedLanguage, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  zh: '中文',
  ko: '한국어',
  th: 'ภาษาไทย',
  ja: '日本語',
  ru: 'Русский',
  fr: 'Français',
  de: 'Deutsch',
  hi: 'हिन्दी',
};

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation('common');
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'vi').slice(0, 2) as SupportedLanguage;

  return (
    <div className="w-32 shrink-0">
      <Select
        value={SUPPORTED_LANGUAGES.includes(current) ? current : 'vi'}
        onChange={(event) => i18n.changeLanguage(event.target.value)}
        aria-label={t('language.label')}
        options={SUPPORTED_LANGUAGES.map((lng) => ({ label: NATIVE_NAMES[lng], value: lng }))}
        className={cn(
          'border-txt/20 bg-transparent px-2 py-1 text-xs font-medium text-txt/80',
          'hover:text-txt focus:ring-1 focus:ring-accent',
          className,
        )}
      />
    </div>
  );
}
