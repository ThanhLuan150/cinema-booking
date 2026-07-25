import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation('common');

  return (
    <footer className="w-full bg-[#1A293C] font-sans text-txt">
      <div className="px-8 py-16 text-center text-white">
        <div className="mx-auto grid w-4/5 grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center justify-center gap-2 font-script text-2xl text-accent">
              {t('brand')}
            </div>
            <p className="mt-4 text-txt">{t('footer.tagline')}</p>
            <div className="mt-4 flex justify-center gap-4 text-xl">
              <i className="fa-brands fa-square-facebook" />
              <i className="fa-brands fa-square-twitter" />
              <i className="fa-brands fa-square-whatsapp" />
              <i className="fa-brands fa-square-instagram" />
            </div>
          </div>
          <div>
            <h5 className="mb-4 font-semibold text-white">{t('footer.quickLink')}</h5>
            <a className="block text-white no-underline" href="homepage.php">
              {t('footer.aboutUs')}
            </a>
            <a className="block text-white no-underline" href="homepage.php">
              {t('footer.movies')}
            </a>
            <a className="block text-white no-underline" href="homepage.php">
              {t('footer.partner')}
            </a>
            <a className="block text-white no-underline" href="homepage.php">
              {t('footer.help')}
            </a>
          </div>
          <div>
            <h5 className="mb-4 font-semibold text-white">{t('footer.important')}</h5>
            <a className="block text-white no-underline" href="homepage.php">
              {t('footer.support')}
            </a>
            <a className="block text-white no-underline" href="homepage.php">
              {t('footer.faq')}
            </a>
            <a className="block text-white no-underline" href="homepage.php">
              {t('footer.check')}
            </a>
            <a className="block text-white no-underline" href="homepage.php">
              {t('footer.contactUs')}
            </a>
          </div>
          <div>
            <h5 className="mb-4 font-semibold text-white">{t('footer.contact')}</h5>
            <p className="text-txt">{t('footer.newsletter')}</p>
            <div className="mt-4 flex justify-center gap-2">
              <input
                type="text"
                name="Send"
                placeholder={t('footer.emailPlaceholder')}
                className="rounded px-2 py-1 text-main"
              />
              <button type="submit" className="rounded bg-accent px-3 py-1 text-white text-nowrap">
                {t('footer.send')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
