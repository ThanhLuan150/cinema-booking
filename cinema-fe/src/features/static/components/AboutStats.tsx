import { useTranslation } from 'react-i18next';
import { Card, CardBody } from '@/components/ui/Card';
import { ABOUT_STATS } from '../constants';

export function AboutStats() {
  const { t } = useTranslation('pages');

  return (
    <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {ABOUT_STATS.map((key) => (
        <Card key={key} className="text-center">
          <CardBody>
            <p className="text-2xl font-bold text-accent sm:text-3xl">{t(`about.stats.${key}.value`)}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-txt/60 sm:text-sm">
              {t(`about.stats.${key}.label`)}
            </p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
