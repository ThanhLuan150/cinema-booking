import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/constants/routes';

export function ContactHelpCards() {
  const { t } = useTranslation('pages');

  return (
    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Card>
        <CardBody>
          <CardTitle className="text-base">{t('contact.faqTitle')}</CardTitle>
          <p className="mt-2 text-sm leading-relaxed text-txt/60">{t('contact.faqDescription')}</p>
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
          <p className="mt-2 text-sm leading-relaxed text-txt/60">{t('contact.bookingDescription')}</p>
          <Link
            to={ROUTES.myBookings}
            className="mt-3 inline-block text-sm font-medium text-accent no-underline transition-colors hover:text-accent-hover"
          >
            {t('contact.bookingLink')} <i className="fa-solid fa-arrow-right ml-1 text-xs" />
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
