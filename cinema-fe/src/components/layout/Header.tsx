import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SearchBox } from '@/components/common/SearchBox';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { cn } from '@/lib/cn';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { logout } from '@/features/auth/store/authSlice';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { toast } from '@/features/notifications/toast';
import { MANAGEMENT_ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';

export function Header() {
  const { t } = useTranslation('common');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { token, role } = useAppSelector((state) => state.auth);
  const isLoggedIn = !!token;
  const canManage = MANAGEMENT_ROLES.includes(Number(role));
  const { data: user } = useCurrentUser();
  const name = user?.name ?? '';

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    dispatch(logout());
    queryClient.clear();
    toast.success(t('header.logoutSuccess'));
    navigate(ROUTES.home);
  };

  return (
    <nav className="fixed inset-x-0 top-0 z-30 flex h-24 items-center justify-between bg-black/80 px-6 font-sans text-txt md:px-[10%]">
      <a href={ROUTES.home} className="flex items-center gap-2 whitespace-nowrap no-underline">
        <b className="font-script text-2xl text-accent">{t('brand')}</b>
      </a>

      <button
        type="button"
        className="text-3xl text-white md:hidden"
        onClick={() => setIsMobileMenuOpen((open) => !open)}
        aria-label={t('header.toggleMenu')}
      >
        <i className="fas fa-bars" />
      </button>

      <ul
        className={cn(
          'flex-col items-center gap-2 bg-black/70 md:static md:flex md:flex-row md:gap-0 md:bg-transparent w-100',
          'fixed inset-x-0 top-24 z-20 md:inset-auto',
          isMobileMenuOpen ? 'flex' : 'hidden md:flex',
        )}
      >
        <li className="p-4 text-center">
          <a href={ROUTES.home} className="text-txt no-underline">
            {t('nav.home')}
          </a>
        </li>
        <li className="group relative p-4 text-center">
          <a href="#" className="text-txt no-underline">
            {t('nav.movies')}
          </a>
          <ul className="static mt-2 hidden bg-black/70 group-hover:block md:absolute md:left-0">
            <li className="p-2">
              <a href={ROUTES.playing} className="text-txt no-underline">
                {t('nav.playing')}
              </a>
            </li>
            <li className="p-2">
              <a href={ROUTES.upcoming} className="text-txt no-underline">
                {t('nav.upcoming')}
              </a>
            </li>
          </ul>
        </li>
        <li className="p-4 text-center">
          <a href={ROUTES.cinemas} className="text-txt no-underline">
            {t('nav.cinemas')}
          </a>
        </li>
        <li className="relative p-4 text-center">
          <button
            type="button"
            className="text-txt"
            onClick={() => setIsSearchOpen((open) => !open)}
            aria-label={t('header.toggleSearch')}
          >
            <i className="fas fa-search" />
          </button>
          {isSearchOpen && (
            <div className="absolute right-0 top-full mt-2 w-72">
              <SearchBox />
            </div>
          )}
        </li>
        <li className="flex items-center p-4 text-center">
          <LanguageSwitcher />
        </li>
        {isLoggedIn ? (
          <li className="relative p-4 d-flex text-center">
            <button
              type="button"
              className="text-txt"
              onClick={() => setIsUserMenuOpen((open) => !open)}
              aria-label={t('header.toggleUserMenu')}
            >
              <i className="fas fa-user" /> <p className='ml-2'>{name}</p>
            </button>
            {isUserMenuOpen && (
              <ul className="absolute right-0 top-full mt-2 w-40 bg-black/70">
                <li className="p-2">
                  <a
                    href={ROUTES.profile}
                    className="text-txt no-underline"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    {t('header.viewProfile')}
                  </a>
                </li>
                <li className="p-2">
                  <a
                    href={ROUTES.myBookings}
                    className="text-txt no-underline"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    {t('header.myBookings')}
                  </a>
                </li>
                <li className="p-2">
                  <a
                    href={ROUTES.changePassword}
                    className="text-txt no-underline"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    {t('header.changePassword')}
                  </a>
                </li>
                {canManage && (
                  <li className="p-2">
                    <a
                      href={ROUTES.adminMovies}
                      className="text-txt no-underline"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      {t('header.manage')}
                    </a>
                  </li>
                )}
                <li className="p-2">
                  <a href="#" onClick={handleLogout} className="text-txt no-underline">
                    {t('header.logout')}
                  </a>
                </li>
              </ul>
            )}
          </li>
        ) : (
          <li className="p-4 text-center">
            <a href={ROUTES.login} className="text-txt no-underline">
              {t('header.login')} <i className="fas fa-user" />
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}
