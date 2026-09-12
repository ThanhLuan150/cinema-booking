import { useTranslation } from 'react-i18next';
import { SectionHeading } from '@/components/common/SectionHeading';
import { StaticPageShell } from '../components/StaticPageShell';
import { ContactChannelsGrid } from '../components/ContactChannelsGrid';
import { ContactHelpCards } from '../components/ContactHelpCards';

const ContactPage = () => {
  const { t } = useTranslation('pages');

  return (
    <StaticPageShell breadcrumbLabel={t('contact.breadcrumb')} maxWidthClassName="max-w-5xl">
      <SectionHeading title={t('contact.title')} align="center" />
      <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-relaxed text-txt/70">
        {t('contact.intro')}
      </p>

      <ContactChannelsGrid />
      <ContactHelpCards />
    </StaticPageShell>
  );
};

export default ContactPage;
