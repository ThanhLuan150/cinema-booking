import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/constants/routes';

const socialIcons = [
  'fa-brands fa-square-facebook',
  'fa-brands fa-square-twitter',
  'fa-brands fa-square-whatsapp',
  'fa-brands fa-square-instagram',
];

const columnTitleClass = 'mb-4 text-sm font-bold uppercase tracking-wider text-white';
const columnLinkClass = 'no-underline transition-colors hover:text-accent';

export function Footer() {
  const { t } = useTranslation('common');

  return (
    <footer className="w-full border-t border-border bg-surface font-sans text-txt">
      <div className="mx-auto max-w-7xl px-6 py-14 md:px-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2 font-script text-3xl text-txt">
              <i className="fa-solid fa-film text-xl text-accent" aria-hidden="true" />
              {t('brand')}
              <span className="text-accent">.</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-txt/60">
              {t('footer.tagline')}
            </p>
            <h5 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wider text-white">
              {t('footer.followUs')}
            </h5>
            <div className="flex gap-3 text-lg text-txt/60">
              {socialIcons.map((icon) => (
                <a
                  key={icon}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong transition-colors hover:border-accent hover:text-accent"
                >
                  <i className={icon} />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <h5 className={columnTitleClass}>{t('footer.quickLink')}</h5>
            <ul className="flex flex-col gap-2.5 text-sm text-txt/60">
              <li>
                <Link to={ROUTES.home} className={columnLinkClass}>
                  {t('footer.aboutUs')}
                </Link>
              </li>
              <li>
                <Link to={ROUTES.playing} className={columnLinkClass}>
                  {t('footer.movies')}
                </Link>
              </li>
              <li>
                <Link to={ROUTES.cinemas} className={columnLinkClass}>
                  {t('footer.partner')}
                </Link>
              </li>
              <li>
                <a href="#" className={columnLinkClass}>
                  {t('footer.help')}
                </a>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h5 className={columnTitleClass}>{t('footer.important')}</h5>
            <ul className="flex flex-col gap-2.5 text-sm text-txt/60">
              <li>
                <a href="#" className={columnLinkClass}>
                  {t('footer.support')}
                </a>
              </li>
              <li>
                <a href="#" className={columnLinkClass}>
                  {t('footer.faq')}
                </a>
              </li>
              <li>
                <a href="#" className={columnLinkClass}>
                  {t('footer.check')}
                </a>
              </li>
              <li>
                <a href="#" className={columnLinkClass}>
                  {t('footer.contactUs')}
                </a>
              </li>
            </ul>
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <h5 className={columnTitleClass}>{t('footer.contact')}</h5>
            <p className="text-sm text-txt/60">{t('footer.newsletter')}</p>
            <form className="mt-4 flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <Input
                type="email"
                name="Send"
                placeholder={t('footer.emailPlaceholder')}
                className="py-2 text-sm"
              />
              <Button type="submit" size="sm">
                {t('footer.send')}
              </Button>
            </form>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-2 border-t border-border pt-6 text-xs text-txt/40 sm:flex-row sm:justify-between">
          <span>
            &copy; {new Date().getFullYear()} {t('brand')}. All rights reserved.
          </span>
          <span>{t('footer.companyInfo')}</span>
        </div>
      </div>
    </footer>
  );
}
