import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ROUTES } from '@/constants/routes';

const questions = [
  'booking',
  'payment',
  'cancel',
  'checkTicket',
  'voucher',
  'combo',
  'account',
  'contact',
] as const;

const FaqPage = () => {
  const { t } = useTranslation('pages');
  const [openKey, setOpenKey] = useState<string | null>(questions[0]);

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <Breadcrumb items={[{ label: t('faq.breadcrumb') }]} />

        <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-10">
          <SectionHeading title={t('faq.title')} align="center" />
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-relaxed text-txt/70">
            {t('faq.intro')}
          </p>

          <div className="flex flex-col gap-3">
            {questions.map((key) => {
              const isOpen = openKey === key;
              return (
                <div
                  key={key}
                  className="overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-white sm:text-base"
                  >
                    {t(`faq.items.${key}.question`)}
                    <i
                      className={`fa-solid fa-chevron-down shrink-0 text-xs text-accent transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <p className="border-t border-border px-5 py-4 text-sm leading-relaxed text-txt/70">
                      {t(`faq.items.${key}.answer`)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-xl border border-border bg-surface px-6 py-8 text-center">
            <h3 className="text-lg font-bold text-white">{t('faq.stillNeedHelpTitle')}</h3>
            <p className="mt-2 text-sm text-txt/60">{t('faq.stillNeedHelpDescription')}</p>
            <Link
              to={ROUTES.contact}
              className="mt-4 inline-block text-sm font-medium text-accent no-underline transition-colors hover:text-accent-hover"
            >
              {t('faq.stillNeedHelpLink')} <i className="fa-solid fa-arrow-right ml-1 text-xs" />
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FaqPage;
