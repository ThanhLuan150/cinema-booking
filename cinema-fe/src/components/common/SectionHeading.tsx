import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export interface SectionHeadingProps {
  title: string;
  viewAllHref?: string;
}

export function SectionHeading({ title, viewAllHref }: SectionHeadingProps) {
  const { t } = useTranslation('common');

  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <h2 className="flex items-center gap-3 text-xl font-bold text-white sm:text-2xl">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        {title}
      </h2>
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
