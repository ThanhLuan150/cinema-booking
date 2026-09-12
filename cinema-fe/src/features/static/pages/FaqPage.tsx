import { useTranslation } from 'react-i18next';
import { SectionHeading } from '@/components/common/SectionHeading';
import { StaticPageShell } from '../components/StaticPageShell';
import { FaqAccordion } from '../components/FaqAccordion';
import { FaqHelpCta } from '../components/FaqHelpCta';

const FaqPage = () => {
  const { t } = useTranslation('pages');

  return (
    <StaticPageShell breadcrumbLabel={t('faq.breadcrumb')} maxWidthClassName="max-w-4xl">
      <SectionHeading title={t('faq.title')} align="center" />
      <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-relaxed text-txt/70">{t('faq.intro')}</p>

      <FaqAccordion />
      <FaqHelpCta />
    </StaticPageShell>
  );
};

export default FaqPage;
