import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

export function FaqHelpCta() {
  const { t } = useTranslation('pages');

  return (
    <div className="mt-10 rounded-xl border border-border bg-surface px-6 py-8 text-center">
      <h3 className="text-lg font-bold text-white">{t('faq.stillNeedHelpTitle')}</h3>
      <p className="mt-2 text-sm text-txt/60">{t('faq.stillNeedHelpDescription')}</p>
      <Link
        to={ROUTES.contact}
        className="mt-4 inline-block text-sm font-medium text-accent no-underline transition-colors hover:text-accent-hover"
      >
        {t('faq.stillNeedHelpLink')} <i className="fa-solid fa-arrow-right ml-1 text-xs" />
      </Link>
    </div>
  );
}
