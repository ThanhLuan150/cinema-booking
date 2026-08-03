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

export function Footer() {
  const { t } = useTranslation('common');

  return (
    <footer className="w-full border-t border-border bg-surface font-sans text-txt">
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-script text-3xl text-txt">
              <i className="fa-solid fa-film text-xl text-accent" aria-hidden="true" />
              {t('brand')}
              <span className="text-accent">.</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-txt/60">{t('footer.tagline')}</p>
            <div className="mt-5 flex gap-3 text-lg text-txt/60">
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
          <div>
            <h5 className="mb-4 text-sm font-semibold uppercase tracking-wider text-txt">
              {t('footer.quickLink')}
            </h5>
            <ul className="flex flex-col gap-2.5 text-sm text-txt/60">
              <li>
                <Link to={ROUTES.home} className="no-underline transition-colors hover:text-accent">
                  {t('footer.aboutUs')}
                </Link>
              </li>
              <li>
                <Link to={ROUTES.playing} className="no-underline transition-colors hover:text-accent">
                  {t('footer.movies')}
                </Link>
              </li>
              <li>
                <Link to={ROUTES.cinemas} className="no-underline transition-colors hover:text-accent">
                  {t('footer.partner')}
                </Link>
              </li>
              <li>
                <a href="#" className="no-underline transition-colors hover:text-accent">
                  {t('footer.help')}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="mb-4 text-sm font-semibold uppercase tracking-wider text-txt">
              {t('footer.important')}
            </h5>
            <ul className="flex flex-col gap-2.5 text-sm text-txt/60">
              <li>
                <a href="#" className="no-underline transition-colors hover:text-accent">
                  {t('footer.support')}
                </a>
              </li>
              <li>
                <a href="#" className="no-underline transition-colors hover:text-accent">
                  {t('footer.faq')}
                </a>
              </li>
              <li>
                <a href="#" className="no-underline transition-colors hover:text-accent">
                  {t('footer.check')}
                </a>
              </li>
              <li>
                <a href="#" className="no-underline transition-colors hover:text-accent">
                  {t('footer.contactUs')}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="mb-4 text-sm font-semibold uppercase tracking-wider text-txt">
              {t('footer.contact')}
            </h5>
            <p className="text-sm text-txt/60">{t('footer.newsletter')}</p>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => e.preventDefault()}
            >
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
        </div>
      </div>
    </footer>
  );
}
