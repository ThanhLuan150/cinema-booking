import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <div className="border-b border-border bg-surface/40">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-6 py-3 text-sm text-txt/70 md:px-10">
        <Link to={ROUTES.home} className="text-txt/70 no-underline transition-colors hover:text-accent">
          <i className="fa-solid fa-house" />
        </Link>
        {items.map((item, index) => (
          <span key={index} className="flex items-center gap-2">
            <i className="fa-solid fa-chevron-right text-xs text-accent" />
            {item.href && index < items.length - 1 ? (
              <Link to={item.href} className="text-txt/70 no-underline transition-colors hover:text-accent">
                {item.label}
              </Link>
            ) : (
              <span className="font-semibold text-white">{item.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
