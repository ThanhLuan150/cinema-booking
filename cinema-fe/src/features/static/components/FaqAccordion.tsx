import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FAQ_QUESTIONS } from '../constants';

export function FaqAccordion() {
  const { t } = useTranslation('pages');
  const [openKey, setOpenKey] = useState<string | null>(FAQ_QUESTIONS[0]);

  return (
    <div className="flex flex-col gap-3">
      {FAQ_QUESTIONS.map((key) => {
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
  );
}
