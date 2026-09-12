import { useTranslation } from 'react-i18next';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { ABOUT_VALUES } from '../constants';

export function AboutValues() {
  const { t } = useTranslation('pages');

  return (
    <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {ABOUT_VALUES.map(({ key, icon }) => (
        <Card key={key} hoverable>
          <CardBody>
            <i className={`${icon} text-2xl text-accent`} aria-hidden="true" />
            <CardTitle className="mt-4">{t(`about.values.${key}.title`)}</CardTitle>
            <p className="mt-2 text-sm leading-relaxed text-txt/60">{t(`about.values.${key}.description`)}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
