import { useTranslation } from 'react-i18next';
import { SectionHeading } from '@/components/common/SectionHeading';
import { StaticPageShell } from '../components/StaticPageShell';
import { AboutStats } from '../components/AboutStats';
import { AboutValues } from '../components/AboutValues';
import { AboutCta } from '../components/AboutCta';

const AboutPage = () => {
  const { t } = useTranslation('pages');

  return (
    <StaticPageShell breadcrumbLabel={t('about.breadcrumb')} maxWidthClassName="max-w-7xl">
      <SectionHeading title={t('about.title')} align="center" />

      <div className="mx-auto max-w-3xl space-y-4 text-center text-sm leading-relaxed text-txt/70 sm:text-base">
        <p>{t('about.intro')}</p>
        <p>{t('about.mission')}</p>
      </div>

      <AboutStats />
      <AboutValues />
      <AboutCta />
    </StaticPageShell>
  );
};

export default AboutPage;
