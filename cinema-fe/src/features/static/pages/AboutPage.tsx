import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { SectionHeading } from '@/components/common/SectionHeading';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/constants/routes';

const values = [
  { key: 'quality', icon: 'fa-solid fa-clapperboard' },
  { key: 'comfort', icon: 'fa-solid fa-couch' },
  { key: 'easyBooking', icon: 'fa-solid fa-ticket' },
  { key: 'support', icon: 'fa-solid fa-headset' },
] as const;

const stats = ['cinemas', 'seats', 'movies', 'customers'] as const;

const AboutPage = () => {
  const { t } = useTranslation('pages');

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <Breadcrumb items={[{ label: t('about.breadcrumb') }]} />

        <div className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
          <SectionHeading title={t('about.title')} align="center" />

          <div className="mx-auto max-w-3xl space-y-4 text-center text-sm leading-relaxed text-txt/70 sm:text-base">
            <p>{t('about.intro')}</p>
            <p>{t('about.mission')}</p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((key) => (
              <Card key={key} className="text-center">
                <CardBody>
                  <p className="text-2xl font-bold text-accent sm:text-3xl">
                    {t(`about.stats.${key}.value`)}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-txt/60 sm:text-sm">
                    {t(`about.stats.${key}.label`)}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map(({ key, icon }) => (
              <Card key={key} hoverable>
                <CardBody>
                  <i className={`${icon} text-2xl text-accent`} aria-hidden="true" />
                  <CardTitle className="mt-4">{t(`about.values.${key}.title`)}</CardTitle>
                  <p className="mt-2 text-sm leading-relaxed text-txt/60">
                    {t(`about.values.${key}.description`)}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>

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
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AboutPage;
