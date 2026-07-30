import { ReactNode, useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useAppDispatch } from '@/hooks/redux';
import { logout } from '@/features/auth/store/authSlice';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { toast } from '@/features/notifications/toast';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';

export interface AdminLayoutProps {
  breadcrumb: string;
  children: ReactNode;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn('flex items-center gap-2 hover:text-[#FFC107]/80', isActive ? 'text-[#FFC107]' : 'text-white hover:text-white/80');

export function AdminLayout({ breadcrumb, children }: AdminLayoutProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isAdmin = user?.role === ROLES.admin;
  const displayName = user?.name || t('adminLayout.adminFallback');

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    dispatch(logout());
    queryClient.clear();
    toast.success(t('header.logoutSuccess'));
    navigate(ROUTES.login);
  };

  return (
    <div className="flex min-h-screen flex-col font-sans lg:flex-row">
      <div className="w-full shrink-0 bg-[#06121E] px-6 py-6 lg:w-1/6">
        <a href={ROUTES.home} className="flex items-center gap-2">
          <b className="font-script text-xl text-accent">CineNova</b>
        </a>
        <nav className="mt-10 flex flex-col gap-6 text-lg">
          {isAdmin && (
            <NavLink to={ROUTES.adminUsers} className={navLinkClass}>
              <ion-icon name="person" />
              <b>{t('adminLayout.nav.user')}</b>
            </NavLink>
          )}
          <NavLink to={isAdmin ? ROUTES.adminDashboard : ROUTES.ownerDashboard} className={navLinkClass}>
            <ion-icon name="stats-chart" />
            <b>{t('adminLayout.nav.dashboard')}</b>
          </NavLink>
          <NavLink to={ROUTES.adminMovies} className={navLinkClass}>
            <ion-icon name="play-circle" />
            <b>{t('adminLayout.nav.films')}</b>
          </NavLink>
          <NavLink to={ROUTES.adminSchedules} className={navLinkClass}>
            <i className="fa-solid fa-calendar-days" />
            <b>{t('adminLayout.nav.schedule')}</b>
          </NavLink>
          <NavLink to={isAdmin ? ROUTES.adminCinemas : ROUTES.ownerCinemas} className={navLinkClass}>
            <ion-icon name="business" />
            <b>{t('adminLayout.nav.cinemas')}</b>
          </NavLink>
          <NavLink to={ROUTES.ownerRooms} className={navLinkClass}>
            <ion-icon name="grid" />
            <b>{t('adminLayout.nav.rooms')}</b>
          </NavLink>
          <NavLink to={ROUTES.ownerCombos} className={navLinkClass}>
            <ion-icon name="fast-food" />
            <b>{t('adminLayout.nav.combos')}</b>
          </NavLink>
          <NavLink to={ROUTES.ownerVouchers} className={navLinkClass}>
            <ion-icon name="pricetag" />
            <b>{t('adminLayout.nav.vouchers')}</b>
          </NavLink>
          <NavLink to={ROUTES.ownerBookings} className={navLinkClass}>
            <ion-icon name="qr-code" />
            <b>{t('adminLayout.nav.bookings')}</b>
          </NavLink>
          {isAdmin && (
            <>
              <NavLink to={ROUTES.adminTransactions} className={navLinkClass}>
                <ion-icon name="card" />
                <b>{t('adminLayout.nav.transactions')}</b>
              </NavLink>
              <NavLink to={ROUTES.adminReviews} className={navLinkClass}>
                <ion-icon name="star" />
                <b>{t('adminLayout.nav.reviews')}</b>
              </NavLink>
            </>
          )}
        </nav>
      </div>
      <div className="flex-1 bg-[#0B1A2A]">
        <div className="flex items-center justify-end gap-3 p-4">
          <LanguageSwitcher className="border-white/20 text-white/80" />
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 text-white hover:text-[#FFC107]"
              onClick={() => setIsUserMenuOpen((open) => !open)}
              aria-label={t('adminLayout.toggleMenu')}
            >
              <ion-icon name="person-circle" className="text-3xl" />
              {displayName}
            </button>
            {isUserMenuOpen && (
              <ul className="absolute right-0 top-full z-10 mt-2 w-40 bg-[#06121E]">
                <li className="p-2 text-white">{displayName}</li>
                <li className="p-2">
                  <a href="#" onClick={handleLogout} className="text-white no-underline hover:text-[#FFC107]">
                    {t('header.logout')}
                  </a>
                </li>
              </ul>
            )}
          </div>
        </div>
        <div className="flex h-12 items-center gap-2 bg-[#858C94] px-4">
          <span className="text-white">{t('adminLayout.breadcrumbPrefix')}</span>
          <span className="text-white">/</span>
          <span className="text-[#FFC107]">{breadcrumb}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-main">{t('adminLayout.hello')}</span>
            <span className="text-[aliceblue]">{displayName}</span>
          </div>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}
