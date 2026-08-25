import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { ROUTES } from '@/constants/routes';

export interface AccountLayoutProps {
  title: string;
  children: ReactNode;
}

/** Galaxy's account area: profile rail on the left, the active page on the right. */
export function AccountLayout({ title, children }: AccountLayoutProps) {
  const { t } = useTranslation('common');
  const { data: user } = useCurrentUser();

  const navItems = [
    { to: ROUTES.profile, icon: 'fa-regular fa-user', label: t('header.viewProfile') },
    { to: ROUTES.myBookings, icon: 'fa-solid fa-ticket', label: t('header.myBookings') },
    { to: ROUTES.myTickets, icon: 'fa-solid fa-qrcode', label: t('header.myTickets') },
    { to: ROUTES.paymentHistory, icon: 'fa-solid fa-receipt', label: t('header.paymentHistory') },
    { to: ROUTES.myRefunds, icon: 'fa-solid fa-hand-holding-dollar', label: t('header.myRefunds') },
    { to: ROUTES.changePassword, icon: 'fa-solid fa-lock', label: t('header.changePassword') },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <Breadcrumb items={[{ label: title }]} />

        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 py-10 md:px-10 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-border bg-surface p-5 shadow-card lg:sticky lg:top-24">
            <div className="flex items-center gap-3 border-b border-border pb-5">
              <Avatar src={user?.avatar} name={user?.name ?? ''} className="h-12 w-12 text-lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">
                  {user?.name || user?.email || ''}
                </p>
                <p className="truncate text-xs text-txt/55">{user?.email}</p>
              </div>
            </div>
            <nav className="mt-4 flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium no-underline transition-colors',
                      isActive
                        ? 'bg-accent text-white shadow-card'
                        : 'text-txt/70 hover:bg-white/5 hover:text-txt',
                    )
                  }
                >
                  <i className={cn(item.icon, 'w-4')} aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="flex flex-col gap-6">
            <h1 className="flex items-center gap-3 text-xl font-bold uppercase tracking-wide text-white sm:text-2xl">
              <span className="h-6 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              {title}
            </h1>
            {children}
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
}
