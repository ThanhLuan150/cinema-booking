import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/constants/routes';

export interface AuthCardProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}

export function AuthCard({ title, subtitle, children, maxWidth = 'max-w-md' }: AuthCardProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-main px-4 py-16">
      <div className={`w-full ${maxWidth}`}>
        <Link to={ROUTES.home} className="mb-8 flex items-center justify-center gap-2 no-underline">
          <i className="fa-solid fa-film text-xl text-accent" aria-hidden="true" />
          <span className="font-script text-3xl leading-none text-txt">
            {t('brand')}
            <span className="text-accent">.</span>
          </span>
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-raised">
          <h1 className="text-center text-xl font-bold uppercase tracking-wide text-white">
            {title}
          </h1>
          <span className="mx-auto mt-3 block h-1 w-14 rounded-full bg-accent" aria-hidden="true" />
          {subtitle && <p className="mt-3 text-center text-sm text-txt/60">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
