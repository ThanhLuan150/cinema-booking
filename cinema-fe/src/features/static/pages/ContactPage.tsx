import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { SectionHeading } from '@/components/common/SectionHeading';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/constants/routes';

/** `href` builds the tel:/mailto: link from the translated value; plain cards omit it. */
const channels = [
  {
    key: 'hotline',
    icon: 'fa-solid fa-phone',
    href: (value: string) => `tel:${value.replace(/\s/g, '')}`,
  },
  { key: 'email', icon: 'fa-solid fa-envelope', href: (value: string) => `mailto:${value}` },
  { key: 'office', icon: 'fa-solid fa-location-dot' },
  { key: 'hours', icon: 'fa-solid fa-clock' },
] as const;

const ContactPage = () => {
  const { t } = useTranslation('pages');

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <Breadcrumb items={[{ label: t('contact.breadcrumb') }]} />

        <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10">
          <SectionHeading title={t('contact.title')} align="center" />
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-relaxed text-txt/70">
            {t('contact.intro')}
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {channels.map((channel) => {
              const value = t(`contact.channels.${channel.key}.value`);
              return (
                <Card key={channel.key} hoverable>
                  <CardBody className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <i className={channel.icon} aria-hidden="true" />
                    </span>
                    <div>
                      <CardTitle className="text-base">
                        {t(`contact.channels.${channel.key}.label`)}
                      </CardTitle>
                      {'href' in channel ? (
                        <a
                          href={channel.href(value)}
                          className="mt-1 inline-block text-sm text-txt/70 no-underline transition-colors hover:text-accent"
                        >
                          {value}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm leading-relaxed text-txt/70">{value}</p>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card>
              <CardBody>
                <CardTitle className="text-base">{t('contact.faqTitle')}</CardTitle>
                <p className="mt-2 text-sm leading-relaxed text-txt/60">
                  {t('contact.faqDescription')}
                </p>
                <Link
                  to={ROUTES.faq}
                  className="mt-3 inline-block text-sm font-medium text-accent no-underline transition-colors hover:text-accent-hover"
                >
                  {t('contact.faqLink')} <i className="fa-solid fa-arrow-right ml-1 text-xs" />
                </Link>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <CardTitle className="text-base">{t('contact.bookingTitle')}</CardTitle>
                <p className="mt-2 text-sm leading-relaxed text-txt/60">
                  {t('contact.bookingDescription')}
                </p>
                <Link
                  to={ROUTES.myBookings}
                  className="mt-3 inline-block text-sm font-medium text-accent no-underline transition-colors hover:text-accent-hover"
                >
                  {t('contact.bookingLink')} <i className="fa-solid fa-arrow-right ml-1 text-xs" />
                </Link>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ContactPage;
