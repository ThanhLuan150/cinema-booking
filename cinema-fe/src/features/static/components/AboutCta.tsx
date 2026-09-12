import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';

export function AboutCta() {
  const { t } = useTranslation('pages');

  return (
    <div className="mt-12 flex flex-col items-center gap-4 rounded-xl border border-border bg-surface px-6 py-10 text-center">
      <h3 className="text-xl font-bold text-white sm:text-2xl">{t('about.ctaTitle')}</h3>
      <p className="max-w-xl text-sm text-txt/60">{t('about.ctaDescription')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to={ROUTES.playing}>
          <Button>{t('about.ctaPrimary')}</Button>
        </Link>
        <Link to={ROUTES.contact}>
          <Button variant="outline">{t('about.ctaSecondary')}</Button>
        </Link>
      </div>
    </div>
  );
}
