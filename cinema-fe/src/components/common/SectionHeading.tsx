import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export interface SectionHeadingProps {
  title: string;
  viewAllHref?: string;
  /** Listing pages centre their title; home sections keep it inline with the tabs. */
  align?: 'left' | 'center';
  /** Tab row: sits beside the title when left aligned, underneath when centred. */
  children?: ReactNode;
}

export function SectionHeading({
  title,
  viewAllHref,
  align = 'left',
  children,
}: SectionHeadingProps) {
  const { t } = useTranslation('common');

  if (align === 'center') {
    return (
      <div className="mb-6 flex flex-col items-center gap-4 text-center sm:mb-8">
        <div className="flex flex-col items-center gap-2.5">
          <h2 className="text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            {title}
          </h2>
          <span className="h-1 w-16 rounded-full bg-accent" aria-hidden="true" />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 sm:mb-8">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <h2 className="flex items-center gap-3 text-xl font-bold uppercase tracking-wide text-white sm:text-2xl">
          <span className="h-6 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          {title}
        </h2>
        {children}
      </div>
      {viewAllHref && (
        <Link
          to={viewAllHref}
          className="shrink-0 whitespace-nowrap text-sm font-medium text-txt/60 no-underline transition-colors hover:text-accent"
        >
          {t('actions.viewAll')} <i className="fa-solid fa-arrow-right ml-1 text-xs" />
        </Link>
      )}
    </div>
  );
}
